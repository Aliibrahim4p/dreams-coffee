import { StagingRepository } from "@/repository/staging-repository";
import { ProductRepository } from "@/repository/product-repository";
import { SyncRepository } from "@/repository/sync-repository";
import { ShiftSessionRepository } from "@/repository/shift-session-repository";
import { SyncService } from "@/services/sync-service";
import { StagingOrderRecord, StagingOrderRecordSchema, StageResult, ProcessedOrderResult } from "@/types/staging";
import { OrderSyncRecord } from "@/types/sync";
import NotFoundException from "@/exceptions/not-found-exception";
import BadRequestException from "@/exceptions/bad-request-exception";
import CashTotalMismatchException from "@/exceptions/cash-total-mismatch-exception";
import PriceMismatchException from "@/exceptions/price-mismatch-exception";
import InvalidSessionException from "@/exceptions/invalid-session-exception";
import InvalidOrderTypeException from "@/exceptions/invalid-order-type-exception";
import StagingStorageException from "@/exceptions/staging-storage-exception";
import logger from "@/util/logger";

const STAGING_PREFIX = "staging/";

type FailureCode =
  | "INVALID_SESSION"
  | "INVALID_ORDER_TYPE"
  | "PRODUCT_NOT_FOUND"
  | "INVALID_MODIFIER"
  | "PRICE_MISMATCH"
  | "CASH_TOTAL_MISMATCH";

function keyToOrderId(key: string): string {
  return key.slice(STAGING_PREFIX.length, key.length - ".json".length);
}

export class StagingService {
  // Best-effort: overwrites the staged blob with the original record plus a `_staging_error`
  // field, so an order sitting in R2 is self-explanatory to anyone inspecting it directly
  // (R2 dashboard, wrangler) instead of just raw order data with no indication of why it's
  // stuck. The extra field is ignored on the next processStaged() read — StagingOrderRecordSchema
  // strips unrecognized keys, so this never affects reprocessing. A failure to write the
  // annotation itself is only logged, never escalated — it must not override or mask the real
  // failure result being returned for this order.
  private static async annotateFailure(
    stagingRepo: StagingRepository,
    record: StagingOrderRecord,
    code: FailureCode | undefined,
    message: string,
  ): Promise<void> {
    const annotated = {
      ...record,
      _staging_error: { code: code ?? null, message, failed_at: new Date().toISOString() },
    };
    try {
      await stagingRepo.putOrder(record.order_id, JSON.stringify(annotated));
    } catch (error) {
      logger.warn("Failed to annotate staged blob for order_id=%s with failure reason: %s", record.order_id, error);
    }
  }

  static async stageRecords(rawRecords: StagingOrderRecord[]): Promise<StageResult[]> {
    const stagingRepo = new StagingRepository();
    const results: StageResult[] = [];

    for (const record of rawRecords) {
      try {
        const key = await stagingRepo.putOrder(record.order_id, JSON.stringify(record));
        results.push({ order_id: record.order_id, staged: true, key });
      } catch (error) {
        if (error instanceof StagingStorageException) {
          results.push({
            order_id: record.order_id,
            staged: false,
            code: "STAGING_STORAGE_UNAVAILABLE",
            message: error.message,
          });
        } else {
          logger.error("Unexpected error staging order_id=%s: %s", record.order_id, error);
          throw error;
        }
      }
    }

    const staged = results.filter((r) => r.staged).length;
    logger.info("Staging batch: %d order(s), %d staged, %d failed", results.length, staged, results.length - staged);

    return results;
  }

  static async processStaged(): Promise<ProcessedOrderResult[]> {
    const stagingRepo = new StagingRepository();
    const productRepo = new ProductRepository();
    const syncRepo = new SyncRepository();
    const shiftSessionRepo = new ShiftSessionRepository();

    const keys = await stagingRepo.listStagedKeys();
    if (keys.length === 0) {
      logger.info("No staged orders to process");
      return [];
    }

    const orderIds = keys.map(keyToOrderId);
    const alreadySynced = await syncRepo.findExistingOrderIds(orderIds);

    const processed: ProcessedOrderResult[] = [];

    for (const key of keys) {
      const orderId = keyToOrderId(key);
      let record: StagingOrderRecord | undefined;
      try {
        if (alreadySynced.has(orderId)) {
          await stagingRepo.deleteObject(key);
          logger.info("order_id=%s already synced, cleaning up leftover staged blob %s", orderId, key);
          processed.push({ key, order_id: orderId, outcome: "already_synced", synced_at: null });
          continue;
        }

        const raw = await stagingRepo.getObject(key);
        const parsedJson: unknown = JSON.parse(raw);
        const parsed = StagingOrderRecordSchema.safeParse(parsedJson);
        if (!parsed.success) {
          processed.push({ key, order_id: orderId, code: "STAGED_BLOB_CORRUPT", message: parsed.error.message });
          continue;
        }
        record = parsed.data;

        const isRefundOrder = (record.transaction_type ?? "sale") === "refund";
        if (isRefundOrder ? record.order_type != null : record.order_type == null) {
          throw new InvalidOrderTypeException(
            record.order_id,
            isRefundOrder
              ? `order_type must be omitted/null for a refund, got ${record.order_type}`
              : "order_type must be dine_in or take_out for a sale",
          );
        }

        if (!(await shiftSessionRepo.isOpenSession(record.session_id))) {
          throw new InvalidSessionException(record.session_id);
        }

        const items = record.line_items.map((item) => ({
          product_id: item.product_id,
          modifier_id: item.modifier_id ?? null,
          unit_price: item.unit_price,
        }));
        const catalogPrices = await productRepo.resolveLineItemPrices(items);

        const grouped = new Map<
          string,
          { product_id: number; modifier_id: number | null; quantity: number; unit_price: number }
        >();
        for (const item of items) {
          const itemKey = `${item.product_id}:${item.modifier_id ?? "null"}`;
          const catalogPrice = catalogPrices.get(itemKey)!;
          if (item.unit_price !== catalogPrice) {
            throw new PriceMismatchException(item.product_id, item.modifier_id, catalogPrice, item.unit_price);
          }

          const existing = grouped.get(itemKey);
          if (existing) {
            existing.quantity += 1;
          } else {
            grouped.set(itemKey, {
              product_id: item.product_id,
              modifier_id: item.modifier_id,
              quantity: 1,
              unit_price: catalogPrice,
            });
          }
        }
        const lineItems = [...grouped.values()];
        const isRefund = record.transaction_type === "refund";
        const sign = isRefund ? -1 : 1;
        const total_due = sign * lineItems.reduce((sum, li) => sum + li.unit_price * li.quantity, 0);

        // Not sent by the client -> assume exact cash, no change. For a refund this defaults
        // cash_tendered to total_due itself (negative), matching seed.ts's own convention
        // (cash_tendered: -amount, change_given: 0) for representing cash paid back out.
        const cashTendered = record.cash_tendered ?? total_due;
        const changeGiven = record.change_given ?? 0;

        // cash_tendered can't be negative (schema-enforced) when the client sends one, so a
        // client-sent value can never reconcile against a refund's negative total_due — refunds
        // don't have a verified cash-sign convention in this codebase yet, so the check is
        // skipped for them rather than guessing one. The default above still applies to what
        // gets stored either way.
        if (!isRefund) {
          const actual = cashTendered - changeGiven;
          if (actual !== total_due) {
            throw new CashTotalMismatchException(record.order_id, total_due, actual);
          }
        }

        const orderSyncRecord: OrderSyncRecord = {
          order_id: record.order_id,
          session_id: record.session_id,
          transaction_type: record.transaction_type,
          order_type: record.order_type,
          status: record.status,
          total_due,
          cash_tendered: cashTendered,
          change_given: changeGiven,
          created_at: record.created_at,
          completed_at: record.completed_at,
          line_items: lineItems,
        };

        const [result] = await SyncService.syncOrderRecords([orderSyncRecord]);
        if (result.sync_status === "synced") {
          await stagingRepo.deleteObject(key);
          processed.push({ key, order_id: result.order_id, outcome: "synced", synced_at: result.synced_at });
        } else {
          await StagingService.annotateFailure(
            stagingRepo,
            record,
            undefined,
            "Sync failed — see server logs for the specific reason (duplicate order_id, closed session, or missing recipe)",
          );
          processed.push({ key, order_id: result.order_id, outcome: "failed" });
        }
      } catch (error) {
        const namedFailure = ((): { code: FailureCode; message: string } | null => {
          if (error instanceof InvalidSessionException) return { code: "INVALID_SESSION", message: error.message };
          if (error instanceof InvalidOrderTypeException) return { code: "INVALID_ORDER_TYPE", message: error.message };
          if (error instanceof NotFoundException) return { code: "PRODUCT_NOT_FOUND", message: error.message };
          if (error instanceof BadRequestException) return { code: "INVALID_MODIFIER", message: error.message };
          if (error instanceof PriceMismatchException) return { code: "PRICE_MISMATCH", message: error.message };
          if (error instanceof CashTotalMismatchException) return { code: "CASH_TOTAL_MISMATCH", message: error.message };
          return null;
        })();

        if (namedFailure) {
          if (record) await StagingService.annotateFailure(stagingRepo, record, namedFailure.code, namedFailure.message);
          processed.push({ key, order_id: orderId, outcome: "failed", ...namedFailure });
        } else if (error instanceof SyntaxError) {
          processed.push({ key, order_id: orderId, code: "STAGED_BLOB_CORRUPT", message: error.message });
        } else if (error instanceof StagingStorageException) {
          processed.push({ key, order_id: orderId, code: "STAGING_STORAGE_UNAVAILABLE", message: error.message });
        } else {
          logger.error("Unexpected error processing staged key=%s: %s", key, error);
          throw error;
        }
      }
    }

    let synced = 0;
    let alreadySyncedCount = 0;
    let failed = 0;
    let errored = 0;
    for (const p of processed) {
      if ("outcome" in p) {
        if (p.outcome === "synced") synced++;
        else if (p.outcome === "already_synced") alreadySyncedCount++;
        else failed++;
      } else {
        errored++;
      }
    }
    logger.info(
      "Processed %d staged order(s): %d synced, %d already synced, %d failed, %d errored",
      processed.length,
      synced,
      alreadySyncedCount,
      failed,
      errored,
    );

    return processed;
  }
}
