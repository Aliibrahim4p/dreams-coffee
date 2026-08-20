import { InventoryCountEntryRepository } from "@/repository/inventory-count-entry-repository";
import { InventoryCountEntryCreate, InventoryCountEntryUpdate } from "@/types/inventory-count-entry";

export class InventoryCountEntryService {
  static async createEntry(data: InventoryCountEntryCreate, managerId: number) {
    return new InventoryCountEntryRepository().createEntry(data, managerId);
  }

  static async updateEntry(countId: string, data: InventoryCountEntryUpdate) {
    return new InventoryCountEntryRepository().updateEntry(countId, data);
  }

  static async listEntries(entryDate?: Date, itemId?: number) {
    return new InventoryCountEntryRepository().listEntries(entryDate, itemId);
  }

  static async getEntry(countId: string) {
    return new InventoryCountEntryRepository().getEntry(countId);
  }
}
