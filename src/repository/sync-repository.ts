import prisma from "@/lib/db";
import { OrderSyncRecord, SyncResult } from "@/types/sync";

export class SyncRepository {
  async syncOrderRecords(records: OrderSyncRecord[]): Promise<SyncResult[]> {
    return Promise.all(records.map((record) => this.syncOne(record)));
  }

  private async syncOne(record: OrderSyncRecord): Promise<SyncResult> {
    const now = new Date();
    try {
      await prisma.order.create({
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
      return {
        order_id: record.order_id,
        sync_status: "synced",
        synced_at: now,
      };
    } catch {
      // bad session_id/product_id/modifier_id, or order_id already synced
      return {
        order_id: record.order_id,
        sync_status: "failed",
        synced_at: null,
      };
    }
  }
}
