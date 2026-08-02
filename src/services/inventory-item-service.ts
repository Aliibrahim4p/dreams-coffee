import { InventoryItemRepository } from "@/repository/inventory-item-repository";
import { InventoryItemCreate } from "@/types/inventory-item";
import logger from "@/util/logger";

export class InventoryItemService {
  static async createInventoryItem(data: InventoryItemCreate) {
    const item = await new InventoryItemRepository().createInventoryItem(data);
    logger.info("Inventory item created: %s (id=%d)", item.name, item.item_id);
    return item;
  }

  static async listInventoryItems(countFrequency?: string, negativeOnly?: boolean, includeInactive?: boolean) {
    return new InventoryItemRepository().listInventoryItems(countFrequency, negativeOnly, includeInactive);
  }

  static async getPackConfigurations(itemId: number) {
    return new InventoryItemRepository().getPackConfigurations(itemId);
  }
}
