import prisma from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import BadRequestException from "@/exceptions/bad-request-exception";
import NotFoundException from "@/exceptions/not-found-exception";
import DuplicateCountEntryException from "@/exceptions/duplicate-count-entry-exception";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { getCurrentBusinessDate, getCountEntryLockDeadline } from "@/lib/business-date";
import { ManagerRepository } from "@/repository/manager-repository";
import { InventoryCountEntryCreate, InventoryCountEntryUpdate } from "@/types/inventory-count-entry";

type EntryWithItem = {
  count_id: string;
  item_id: number;
  manager_id: number;
  physical_count: Prisma.Decimal;
  entry_date: Date;
  is_locked: boolean;
  sync_status: string;
  synced_at: Date | null;
  item: { name: string; current_stock: Prisma.Decimal };
};

function mapEntry(entry: EntryWithItem) {
  const expectedStock = Number(entry.item.current_stock);
  const physicalCount = Number(entry.physical_count);
  return {
    count_id: entry.count_id,
    item_id: entry.item_id,
    item_name: entry.item.name,
    manager_id: entry.manager_id,
    physical_count: physicalCount,
    expected_stock: expectedStock,
    variance: physicalCount - expectedStock,
    entry_date: entry.entry_date,
    is_locked: new Date() >= getCountEntryLockDeadline(entry.entry_date),
    sync_status: entry.sync_status,
    synced_at: entry.synced_at,
  };
}

export class InventoryCountEntryRepository {
  async createEntry(data: InventoryCountEntryCreate, managerId: number) {
    const item = await prisma.inventoryItem.findUnique({ where: { item_id: data.item_id } });
    if (!item) {
      throw new BadRequestException("item_id not in the predefined list");
    }

    const manager = await new ManagerRepository().findManager(managerId);
    if (!manager) {
      throw new BadRequestException("Invalid manager_id");
    }

    const entryDate = getCurrentBusinessDate();
    const existing = await prisma.inventoryCountEntry.findUnique({
      where: { item_id_entry_date: { item_id: data.item_id, entry_date: entryDate } },
    });
    if (existing) {
      throw new DuplicateCountEntryException(
        "An entry already exists for this item today — PATCH it instead",
        existing.count_id,
      );
    }

    try {
      const entry = await prisma.inventoryCountEntry.create({
        data: {
          item_id: data.item_id,
          manager_id: managerId,
          physical_count: data.physical_count,
          entry_date: entryDate,
        },
        include: { item: true },
      });
      return mapEntry(entry);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        // Lost a race against a concurrent submission for the same item/business date.
        const race = await prisma.inventoryCountEntry.findUniqueOrThrow({
          where: { item_id_entry_date: { item_id: data.item_id, entry_date: entryDate } },
        });
        throw new DuplicateCountEntryException(
          "An entry already exists for this item today — PATCH it instead",
          race.count_id,
        );
      }
      throw error;
    }
  }

  async updateEntry(countId: string, data: InventoryCountEntryUpdate) {
    const entry = await prisma.inventoryCountEntry.findUnique({ where: { count_id: countId } });
    if (!entry) {
      throw new NotFoundException("Count entry not found");
    }

    if (new Date() >= getCountEntryLockDeadline(entry.entry_date)) {
      throw new BadRequestException(
        "Count entry is locked — it can only be modified until 3am the day after it was submitted",
      );
    }

    const updated = await prisma.inventoryCountEntry.update({
      where: { count_id: countId },
      data: { physical_count: data.physical_count },
      include: { item: true },
    });
    return mapEntry(updated);
  }

  async listEntries(entryDate?: Date, itemId?: number) {
    const entries = await prisma.inventoryCountEntry.findMany({
      where: {
        entry_date: entryDate ?? getCurrentBusinessDate(),
        ...(itemId !== undefined ? { item_id: itemId } : {}),
      },
      include: { item: true },
    });
    return entries.map(mapEntry);
  }

  async getEntry(countId: string) {
    const entry = await prisma.inventoryCountEntry.findUnique({
      where: { count_id: countId },
      include: { item: true },
    });
    if (!entry) {
      throw new NotFoundException("Count entry not found");
    }
    return mapEntry(entry);
  }
}
