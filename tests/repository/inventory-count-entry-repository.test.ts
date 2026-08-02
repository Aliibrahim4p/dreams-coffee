jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    inventoryItem: { findUnique: jest.fn() },
    manager: { findUnique: jest.fn() },
    inventoryCountEntry: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import prisma from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import BadRequestException from "@/exceptions/bad-request-exception";
import NotFoundException from "@/exceptions/not-found-exception";
import DuplicateCountEntryException from "@/exceptions/duplicate-count-entry-exception";
import { InventoryCountEntryRepository } from "@/repository/inventory-count-entry-repository";

const db = prisma as unknown as {
  inventoryItem: { findUnique: jest.Mock };
  manager: { findUnique: jest.Mock };
  inventoryCountEntry: {
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

function uniqueError(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError("unique violation", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

const managerRow = { manager_id: 2, username: "jdoe" };

const itemRow = { item_id: 1, name: "Milk", current_stock: 100 };

const entryRow = {
  count_id: "count-1",
  item_id: 1,
  manager_id: 2,
  physical_count: 90,
  entry_date: new Date("2026-07-31"),
  is_locked: false,
  sync_status: "pending",
  synced_at: null,
  item: itemRow,
};

describe("InventoryCountEntryRepository.createEntry", () => {
  const repo = new InventoryCountEntryRepository();

  it("throws BadRequestException when item_id is not in the predefined list", async () => {
    db.inventoryItem.findUnique.mockResolvedValue(null);

    await expect(
      repo.createEntry({ item_id: 999, physical_count: 10 }, 2),
    ).rejects.toThrow(BadRequestException);
    expect(db.manager.findUnique).not.toHaveBeenCalled();
  });

  it("throws BadRequestException when manager_id does not exist", async () => {
    db.inventoryItem.findUnique.mockResolvedValue(itemRow);
    db.manager.findUnique.mockResolvedValue(null);

    await expect(
      repo.createEntry({ item_id: 1, physical_count: 90 }, 999),
    ).rejects.toThrow(BadRequestException);
    expect(db.inventoryCountEntry.findUnique).not.toHaveBeenCalled();
  });

  it("throws DuplicateCountEntryException with the existing count_id when already submitted today", async () => {
    db.inventoryItem.findUnique.mockResolvedValue(itemRow);
    db.manager.findUnique.mockResolvedValue(managerRow);
    db.inventoryCountEntry.findUnique.mockResolvedValue({ count_id: "existing-id" });

    await expect(
      repo.createEntry({ item_id: 1, physical_count: 90 }, 2),
    ).rejects.toMatchObject({ count_id: "existing-id" });
  });

  it("creates the entry and returns computed expected_stock and variance", async () => {
    db.inventoryItem.findUnique.mockResolvedValue(itemRow);
    db.manager.findUnique.mockResolvedValue(managerRow);
    db.inventoryCountEntry.findUnique.mockResolvedValue(null);
    db.inventoryCountEntry.create.mockResolvedValue(entryRow);

    const result = await repo.createEntry({ item_id: 1, physical_count: 90 }, 2);

    expect(result.expected_stock).toBe(100);
    expect(result.variance).toBe(-10);
    expect(result.item_name).toBe("Milk");
  });

  it("throws DuplicateCountEntryException when a concurrent request wins the race after the pre-check passed", async () => {
    db.inventoryItem.findUnique.mockResolvedValue(itemRow);
    db.manager.findUnique.mockResolvedValue(managerRow);
    db.inventoryCountEntry.findUnique.mockResolvedValue(null);
    db.inventoryCountEntry.create.mockRejectedValue(uniqueError(["item_id", "entry_date"]));
    db.inventoryCountEntry.findUniqueOrThrow.mockResolvedValue({ count_id: "raced-in-id" });

    await expect(
      repo.createEntry({ item_id: 1, physical_count: 90 }, 2),
    ).rejects.toMatchObject({ count_id: "raced-in-id" });
    await expect(
      repo.createEntry({ item_id: 1, physical_count: 90 }, 2),
    ).rejects.toBeInstanceOf(DuplicateCountEntryException);
  });
});

describe("InventoryCountEntryRepository.updateEntry", () => {
  const repo = new InventoryCountEntryRepository();

  afterEach(() => {
    jest.useRealTimers();
  });

  it("throws NotFoundException when the entry does not exist", async () => {
    db.inventoryCountEntry.findUnique.mockResolvedValue(null);
    await expect(repo.updateEntry("missing", { physical_count: 10 })).rejects.toThrow(NotFoundException);
  });

  it("allows the update before the Aug 3 03:00 Beirut lock deadline for an Aug 2 entry", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-02T20:00:00.000Z"));
    const augSecond = new Date(Date.UTC(2026, 7, 2));
    db.inventoryCountEntry.findUnique.mockResolvedValue({ ...entryRow, entry_date: augSecond });
    db.inventoryCountEntry.update.mockResolvedValue({ ...entryRow, entry_date: augSecond, physical_count: 95 });

    const result = await repo.updateEntry("count-1", { physical_count: 95 });

    expect(result.physical_count).toBe(95);
    expect(db.inventoryCountEntry.update).toHaveBeenCalledWith({
      where: { count_id: "count-1" },
      data: { physical_count: 95 },
      include: { item: true },
    });
  });

  it("throws BadRequestException once past the Aug 3 03:00 Beirut lock deadline for an Aug 2 entry", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-03T00:00:01.000Z"));
    db.inventoryCountEntry.findUnique.mockResolvedValue({
      ...entryRow,
      entry_date: new Date(Date.UTC(2026, 7, 2)),
    });

    await expect(repo.updateEntry("count-1", { physical_count: 95 })).rejects.toThrow(BadRequestException);
    expect(db.inventoryCountEntry.update).not.toHaveBeenCalled();
  });

  it("allows the update at 02:59:59 Beirut time the day after (one second before the lock)", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-02T23:59:59.000Z"));
    const augSecond = new Date(Date.UTC(2026, 7, 2));
    db.inventoryCountEntry.findUnique.mockResolvedValue({ ...entryRow, entry_date: augSecond });
    db.inventoryCountEntry.update.mockResolvedValue({ ...entryRow, entry_date: augSecond, physical_count: 95 });

    await expect(repo.updateEntry("count-1", { physical_count: 95 })).resolves.toBeDefined();
  });
});

describe("InventoryCountEntryRepository.listEntries", () => {
  const repo = new InventoryCountEntryRepository();

  it("filters by item_id when provided", async () => {
    db.inventoryCountEntry.findMany.mockResolvedValue([entryRow]);

    await repo.listEntries(new Date("2026-07-31"), 1);

    expect(db.inventoryCountEntry.findMany).toHaveBeenCalledWith({
      where: { entry_date: new Date("2026-07-31"), item_id: 1 },
      include: { item: true },
    });
  });
});

describe("InventoryCountEntryRepository.getEntry", () => {
  const repo = new InventoryCountEntryRepository();

  afterEach(() => {
    jest.useRealTimers();
  });

  it("throws NotFoundException when the entry does not exist", async () => {
    db.inventoryCountEntry.findUnique.mockResolvedValue(null);

    await expect(repo.getEntry("missing")).rejects.toThrow(NotFoundException);
  });

  it("returns the mapped entry", async () => {
    db.inventoryCountEntry.findUnique.mockResolvedValue(entryRow);

    const result = await repo.getEntry("count-1");

    expect(result.count_id).toBe("count-1");
    expect(result.variance).toBe(-10);
  });

  it("computes is_locked from the deadline, ignoring the raw is_locked column", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-03T00:00:01.000Z"));
    // is_locked: false on the row itself — the computed value must override it
    db.inventoryCountEntry.findUnique.mockResolvedValue({
      ...entryRow,
      entry_date: new Date(Date.UTC(2026, 7, 2)),
      is_locked: false,
    });

    const result = await repo.getEntry("count-1");

    expect(result.is_locked).toBe(true);
  });

  it("reports is_locked: false before the deadline even if the raw column says true", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-02T20:00:00.000Z"));
    db.inventoryCountEntry.findUnique.mockResolvedValue({
      ...entryRow,
      entry_date: new Date(Date.UTC(2026, 7, 2)),
      is_locked: true,
    });

    const result = await repo.getEntry("count-1");

    expect(result.is_locked).toBe(false);
  });
});
