import { InventoryCountEntryRepository } from "@/repository/inventory-count-entry-repository";
import { InventoryCountEntryCreate, InventoryCountEntryUpdate } from "@/types/inventory-count-entry";
import logger from "@/util/logger";

export class InventoryCountEntryService {
  static async createEntry(data: InventoryCountEntryCreate, managerId: number) {
    const entry = await new InventoryCountEntryRepository().createEntry(data, managerId);
    logger.info("Inventory count entry created: id=%s item=%d by manager=%d", entry.count_id, data.item_id, managerId);
    return entry;
  }

  static async updateEntry(countId: string, data: InventoryCountEntryUpdate) {
    const entry = await new InventoryCountEntryRepository().updateEntry(countId, data);
    logger.info("Inventory count entry updated: id=%s", countId);
    return entry;
  }

  static async listEntries(entryDate?: Date, itemId?: number) {
    return new InventoryCountEntryRepository().listEntries(entryDate, itemId);
  }

  static async getEntry(countId: string) {
    return new InventoryCountEntryRepository().getEntry(countId);
  }
}
