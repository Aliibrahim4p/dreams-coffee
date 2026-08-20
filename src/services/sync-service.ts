import { SyncRepository } from "@/repository/sync-repository";
import { OrderSyncRecord } from "@/types/sync";
import logger from "@/util/logger";

export class SyncService {
  static async syncOrderRecords(records: OrderSyncRecord[]) {
    const results = await new SyncRepository().syncOrderRecords(records);
    const failed = results.filter((r) => r.sync_status === "failed").length;
    logger.info("Order sync batch: %d records, %d failed", results.length, failed);
    return results;
  }
}
