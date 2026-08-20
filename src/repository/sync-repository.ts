import { getCurrentBusinessDateTime } from "@/lib/business-date";
import prisma from "@/lib/db";
import { isForeignKeyConstraintError, isUniqueConstraintError } from "@/lib/prisma-errors";
import RecipeNotFoundException from "@/exceptions/recipe-not-found-exception";
import SessionClosedException from "@/exceptions/session-closed-exception";
import { OrderSyncRecord, SyncResult } from "@/types/sync";
import logger from "@/util/logger";

// Bounds how many order.create transactions run at once for a single batch, so a
// large offline queue can't saturate the DB connection pool and starve other requests.
const MAX_CONCURRENT_SYNCS = 5;

export class SyncRepository {
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

        // deduct from stock the raw materials used in the order: for each line
        // item, find its recipe, then decrement every ingredient it consumes
        for (const line of record.line_items) {
          const recipe = await tx.recipe.findMany({
            where: {
              product_id: line.product_id,
              modifier_id: line.modifier_id ?? null,
            },
          });
          if (recipe.length === 0) {
            throw new RecipeNotFoundException(
              `No recipe found for product_id=${line.product_id} modifier_id=${line.modifier_id ?? "null"}`,
            );
          }
          const recipeItems = await tx.recipeIngredient.findMany({
            where: {
              recipe_id: recipe[0].recipe_id,
            },
          });
          for (const recipeItem of recipeItems) {
            await tx.inventoryItem.update({
              where: {
                item_id: recipeItem.item_id,
              },
              data: {
                current_stock: {
                  decrement: recipeItem.quantity.times(line.quantity),
                },
              },
            });
          }
        }
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
