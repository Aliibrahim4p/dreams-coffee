import prisma from "@/lib/db";
import { CountFrequency, PackType, Prisma } from "@/app/generated/prisma/client";
import UniqueException from "@/exceptions/unique-exception";
import NotFoundException from "@/exceptions/not-found-exception";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { InventoryItemCreate } from "@/types/inventory-item";
import logger from "@/util/logger";

function mapInventoryItem(item: {
  item_id: number;
  name: string;
  unit: string;
  current_stock: Prisma.Decimal;
  count_frequency: string;
  is_negative_flag: boolean;
  is_active: boolean;
}) {
  return {
    item_id: item.item_id,
    name: item.name,
    unit: item.unit,
    current_stock: Number(item.current_stock),
    count_frequency: item.count_frequency,
    is_negative_flag: item.is_negative_flag,
    is_active: item.is_active,
  };
}

function mapPackConfiguration(config: {
  config_id: number;
  item_id: number;
  pack_name: PackType;
  base_unit_qty: Prisma.Decimal;
}) {
  return {
    config_id: config.config_id,
    item_id: config.item_id,
    pack_name: config.pack_name,
    base_unit_qty: Number(config.base_unit_qty),
  };
}

export class InventoryItemRepository {
  async createInventoryItem(data: InventoryItemCreate) {
    try {
      const item = await prisma.inventoryItem.create({ data });
      return mapInventoryItem(item);
    } catch (error) {
      if (isUniqueConstraintError(error, "name")) {
        throw new UniqueException("Item name already exists");
      }
      logger.error("Failed to create inventory item name=%s: %s", data.name, error);
      throw error;
    }
  }

  async listInventoryItems(countFrequency?: string, negativeOnly?: boolean, includeInactive?: boolean) {
    const items = await prisma.inventoryItem.findMany({
      where: {
        ...(countFrequency ? { count_frequency: countFrequency as CountFrequency } : {}),
        ...(negativeOnly ? { is_negative_flag: true } : {}),
        ...(includeInactive ? {} : { is_active: true }),
      },
    });
    return items.map(mapInventoryItem);
  }

  async getPackConfigurations(itemId: number) {
    const item = await prisma.inventoryItem.findUnique({ where: { item_id: itemId } });
    if (!item) {
      throw new NotFoundException("Item not found");
    }
    const configs = await prisma.packConfiguration.findMany({ where: { item_id: itemId } });
    return configs.map(mapPackConfiguration);
  }
}
