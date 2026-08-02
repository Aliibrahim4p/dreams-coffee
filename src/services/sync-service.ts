import { SyncRepository } from "@/repository/sync-repository";
import { OrderSyncRecord } from "@/types/sync";

export class SyncService {
  static async syncOrderRecords(records: OrderSyncRecord[]) {
    return new SyncRepository().syncOrderRecords(records);
  }
}
