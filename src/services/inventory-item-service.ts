import { InventoryItemRepository } from "@/repository/inventory-item-repository";
import { InventoryItemCreate } from "@/types/inventory-item";

export class InventoryItemService {
  static async createInventoryItem(data: InventoryItemCreate) {
    return new InventoryItemRepository().createInventoryItem(data);
  }

  static async listInventoryItems(countFrequency?: string, negativeOnly?: boolean, includeInactive?: boolean) {
    return new InventoryItemRepository().listInventoryItems(countFrequency, negativeOnly, includeInactive);
  }

  static async getPackConfigurations(itemId: number) {
    return new InventoryItemRepository().getPackConfigurations(itemId);
  }
}
