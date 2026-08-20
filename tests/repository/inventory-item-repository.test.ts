jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    inventoryItem: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    packConfiguration: { findMany: jest.fn() },
  },
}));

import prisma from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import UniqueException from "@/exceptions/unique-exception";
import NotFoundException from "@/exceptions/not-found-exception";
import { InventoryItemRepository } from "@/repository/inventory-item-repository";

const db = prisma as unknown as {
  inventoryItem: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
  packConfiguration: { findMany: jest.Mock };
};

function uniqueError(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError("unique violation", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

const itemRow = {
  item_id: 1,
  name: "Milk",
  unit: "ml",
  current_stock: 1000,
  count_frequency: "daily",
  is_negative_flag: false,
  is_active: true,
};

describe("InventoryItemRepository.createInventoryItem", () => {
  const repo = new InventoryItemRepository();

  it("creates and returns the mapped item", async () => {
    db.inventoryItem.create.mockResolvedValue(itemRow);

    const result = await repo.createInventoryItem({ name: "Milk", unit: "ml", count_frequency: "daily" });

    expect(result).toEqual(itemRow);
  });

  it("throws UniqueException when the item name already exists", async () => {
    db.inventoryItem.create.mockRejectedValue(uniqueError(["name"]));

    await expect(
      repo.createInventoryItem({ name: "Milk", unit: "ml", count_frequency: "daily" }),
    ).rejects.toThrow(UniqueException);
  });
});

describe("InventoryItemRepository.listInventoryItems", () => {
  const repo = new InventoryItemRepository();

  it("excludes inactive items by default", async () => {
    db.inventoryItem.findMany.mockResolvedValue([itemRow]);

    await repo.listInventoryItems();

    expect(db.inventoryItem.findMany).toHaveBeenCalledWith({ where: { is_active: true } });
  });

  it("includes inactive items when includeInactive is true", async () => {
    db.inventoryItem.findMany.mockResolvedValue([itemRow]);

    await repo.listInventoryItems(undefined, undefined, true);

    expect(db.inventoryItem.findMany).toHaveBeenCalledWith({ where: {} });
  });

  it("filters by count_frequency and negative_only", async () => {
    db.inventoryItem.findMany.mockResolvedValue([itemRow]);

    await repo.listInventoryItems("daily", true);

    expect(db.inventoryItem.findMany).toHaveBeenCalledWith({
      where: { count_frequency: "daily", is_negative_flag: true, is_active: true },
    });
  });
});

describe("InventoryItemRepository.getPackConfigurations", () => {
  const repo = new InventoryItemRepository();

  it("throws NotFoundException when the item does not exist", async () => {
    db.inventoryItem.findUnique.mockResolvedValue(null);

    await expect(repo.getPackConfigurations(999)).rejects.toThrow(NotFoundException);
  });

  it("returns the mapped pack configurations", async () => {
    db.inventoryItem.findUnique.mockResolvedValue(itemRow);
    db.packConfiguration.findMany.mockResolvedValue([
      { config_id: 1, item_id: 1, pack_name: "box", base_unit_qty: 12 },
    ]);

    const result = await repo.getPackConfigurations(1);

    expect(result).toEqual([{ config_id: 1, item_id: 1, pack_name: "box", base_unit_qty: 12 }]);
  });
});
