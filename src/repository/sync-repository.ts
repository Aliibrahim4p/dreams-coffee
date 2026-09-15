import { getCurrentBusinessDateTime } from "@/lib/business-date";
import prisma from "@/lib/db";
import { isForeignKeyConstraintError, isUniqueConstraintError } from "@/lib/prisma-errors";
import RecipeNotFoundException from "@/exceptions/recipe-not-found-exception";
import SessionClosedException from "@/exceptions/session-closed-exception";
import { OrderSyncRecord, SyncResult } from "@/types/sync";
import logger from "@/util/logger";
import { Prisma } from "@/app/generated/prisma/client";

const lineItemKey = (line: { product_id: number; modifier_id?: number | null }) =>
  `${line.product_id}:${line.modifier_id ?? "null"}`;

// Bounds how many order.create transactions run at once for a single batch, so a
// large offline queue can't saturate the DB connection pool and starve other requests.
const MAX_CONCURRENT_SYNCS = 5;

export class SyncRepository {
  async findExistingOrderIds(orderIds: string[]): Promise<Set<string>> {
    const existing = await prisma.order.findMany({
      where: { order_id: { in: orderIds } },
      select: { order_id: true },
    });
    return new Set(existing.map((order) => order.order_id));
  }

  async syncOrderRecords(records: OrderSyncRecord[]): Promise<SyncResult[]> {
    const results: SyncResult[] = new Array(records.length);
    let next = 0;

    const worker = async () => {
      while (next < records.length) {
        const index = next++;
        results[index] = await this.syncOne(records[index]);
      }
    };

    const workerCount = Math.min(MAX_CONCURRENT_SYNCS, records.length);
    await Promise.all(Array.from({ length: workerCount }, worker));

    return results;
  }

  private async syncOne(record: OrderSyncRecord): Promise<SyncResult> {
    const now = getCurrentBusinessDateTime();
    try {
      await prisma.$transaction(async (tx) => {
        // The FK on order.session_id only proves the session exists, not that
        // it's still open — a session can close (by cash-out, including the
        // admin-by-id override which doesn't go through this terminal at all)
        // while this record was still queued offline. An unknown session_id
        // is left to the FK violation below; this only catches "exists but
        // already closed".
        const session = await tx.shiftSession.findUnique({
          where: { session_id: record.session_id },
          select: { end_time: true },
        });
        if (session && session.end_time !== null) {
          throw new SessionClosedException(`Session ${record.session_id} is already closed`);
        }

        await tx.order.create({
          data: {
            order_id: record.order_id,
            session_id: record.session_id,
            transaction_type: record.transaction_type ?? "sale",
            order_type: record.order_type ?? null,
            status: record.status ?? "completed",
            total_due: record.total_due,
            cash_tendered: record.cash_tendered ?? null,
            change_given: record.change_given ?? null,
            created_at: record.created_at,
            completed_at: record.completed_at ?? null,
            sync_status: "synced",
            synced_at: now,
            line_items: {
              create: record.line_items.map((line) => ({
                product_id: line.product_id,
                modifier_id: line.modifier_id ?? null,
                quantity: line.quantity,
                unit_price: line.unit_price,
              })),
            },
          },
        });

        await this.adjustStock(tx, record);
      });

      return {
        order_id: record.order_id,
        sync_status: "synced",
        synced_at: now,
      };
    } catch (error) {
      if (!SyncRepository.isExpectedSyncFailure(error)) {
        // Not one of the known data conflicts below — a DB outage, Prisma
        // misconfig, etc. Rethrow so it surfaces as a 500 instead of silently
        // being reported as a per-record failure.
        throw error;
      }

      // bad session_id/product_id/modifier_id (FK violation), missing recipe,
      // order_id already synced (unique violation), or the session has since
      // closed — $transaction rolls back the order create + any stock
      // decrements that already ran, so a failed record never leaves partial
      // writes behind.
      logger.warn("Order sync failed for order_id=%s: %s", record.order_id, error);
      return {
        order_id: record.order_id,
        sync_status: "failed",
        synced_at: null,
      };
    }
  }

  // Adjusts stock for every raw ingredient this order touches, in a fixed number of
  // queries regardless of how many line items the order has: one findMany for every
  // recipe the order needs, one findMany for every ingredient those recipes use, then
  // one update per distinct ingredient (summed across every line item that consumes it,
  // so a shared ingredient is only ever written once). A sale decrements (consuming
  // stock); a refund increments the exact same amounts back (returning stock) — the
  // order is being reversed, not repeated.
  private async adjustStock(tx: Prisma.TransactionClient, record: OrderSyncRecord): Promise<void> {
    if (record.line_items.length === 0) return;

    const isRefund = (record.transaction_type ?? "sale") === "refund";

    const recipes = await tx.recipe.findMany({
      where: { OR: record.line_items.map((line) => ({ product_id: line.product_id, modifier_id: line.modifier_id ?? null })) },
    });
    const recipeByLineItem = new Map(recipes.map((recipe) => [lineItemKey(recipe), recipe]));

    const recipeIdByLine = record.line_items.map((line) => {
      const recipe = recipeByLineItem.get(lineItemKey(line));
      if (!recipe) {
        throw new RecipeNotFoundException(
          `No recipe found for product_id=${line.product_id} modifier_id=${line.modifier_id ?? "null"}`,
        );
      }
      return recipe.recipe_id;
    });

    const ingredients = await tx.recipeIngredient.findMany({
      where: { recipe_id: { in: [...new Set(recipeIdByLine)] } },
    });
    const ingredientsByRecipe = new Map<number, typeof ingredients>();
    for (const ingredient of ingredients) {
      const list = ingredientsByRecipe.get(ingredient.recipe_id);
      if (list) list.push(ingredient);
      else ingredientsByRecipe.set(ingredient.recipe_id, [ingredient]);
    }

    const totalByIngredient = new Map<number, Prisma.Decimal>();
    record.line_items.forEach((line, i) => {
      const recipeIngredients = ingredientsByRecipe.get(recipeIdByLine[i]) ?? [];
      for (const ingredient of recipeIngredients) {
        const amount = ingredient.quantity.times(line.quantity);
        totalByIngredient.set(ingredient.item_id, (totalByIngredient.get(ingredient.item_id) ?? new Prisma.Decimal(0)).plus(amount));
      }
    });

    await Promise.all(
      Array.from(totalByIngredient, ([item_id, amount]) =>
        tx.inventoryItem.update({
          where: { item_id },
          data: { current_stock: isRefund ? { increment: amount } : { decrement: amount } },
        }),
      ),
    );
  }

  // The data conflicts the sync contract treats as expected, per-record
  // failures rather than server errors: a resend of an order_id that's already
  // synced, an unknown session_id/product_id/modifier_id, a product/modifier
  // with no seeded recipe, or a session that's already been closed.
  private static isExpectedSyncFailure(error: unknown): boolean {
    return (
      isUniqueConstraintError(error, "order_id") ||
      isForeignKeyConstraintError(error) ||
      error instanceof RecipeNotFoundException ||
      error instanceof SessionClosedException
    );
  }
}
