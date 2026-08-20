const mockTx = {
  order: { create: jest.fn() },
  recipe: { findMany: jest.fn() },
  recipeIngredient: { findMany: jest.fn() },
  inventoryItem: { update: jest.fn() },
  shiftSession: { findUnique: jest.fn() },
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(mockTx)),
  },
}));

import { SyncRepository } from "@/repository/sync-repository";
import { OrderSyncRecord } from "@/types/sync";
import { Prisma } from "@/app/generated/prisma/client";

function uniqueError(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError("unique violation", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

function foreignKeyError() {
  return new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
    code: "P2003",
    clientVersion: "test",
  });
}

const baseRecord: OrderSyncRecord = {
  order_id: "order-1",
  session_id: "session-1",
  transaction_type: "sale",
  order_type: "take_out",
  status: "completed",
  total_due: 5000,
  cash_tendered: 5000,
  change_given: 0,
  created_at: new Date("2026-08-01T10:00:00Z"),
  completed_at: new Date("2026-08-01T10:05:00Z"),
  line_items: [{ product_id: 1, modifier_id: 2, quantity: 2, unit_price: 2500 }],
};

describe("SyncRepository.syncOrderRecords", () => {
  const repo = new SyncRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.order.create.mockResolvedValue({});
    mockTx.recipe.findMany.mockResolvedValue([{ recipe_id: 1 }]);
    mockTx.recipeIngredient.findMany.mockResolvedValue([]);
    mockTx.inventoryItem.update.mockResolvedValue({});
    mockTx.shiftSession.findUnique.mockResolvedValue({ end_time: null });
  });

  it("inserts the order with nested line items, returning synced status", async () => {
    const results = await repo.syncOrderRecords([baseRecord]);

    expect(mockTx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        order_id: "order-1",
        session_id: "session-1",
        sync_status: "synced",
        line_items: { create: [{ product_id: 1, modifier_id: 2, quantity: 2, unit_price: 2500 }] },
      }),
    });
    expect(results).toEqual([{ order_id: "order-1", sync_status: "synced", synced_at: expect.any(Date) }]);
  });

  it("marks a record as failed when create throws a foreign key violation (bad session_id/product_id/modifier_id)", async () => {
    mockTx.order.create.mockRejectedValueOnce(foreignKeyError());

    const results = await repo.syncOrderRecords([baseRecord]);

    expect(results).toEqual([{ order_id: "order-1", sync_status: "failed", synced_at: null }]);
  });

  it("marks a record as failed when create throws a unique violation on order_id (already-synced resend)", async () => {
    mockTx.order.create.mockRejectedValueOnce(uniqueError(["order_id"]));

    const results = await repo.syncOrderRecords([baseRecord]);

    expect(results).toEqual([{ order_id: "order-1", sync_status: "failed", synced_at: null }]);
  });

  it("marks a record as failed when the session has already been closed (e.g. cashed out by an admin while queued offline)", async () => {
    mockTx.shiftSession.findUnique.mockResolvedValueOnce({ end_time: new Date("2026-08-01T12:00:00Z") });

    const results = await repo.syncOrderRecords([baseRecord]);

    expect(results).toEqual([{ order_id: "order-1", sync_status: "failed", synced_at: null }]);
    expect(mockTx.order.create).not.toHaveBeenCalled();
  });

  it("does not fail the record when the session doesn't exist yet — left to the FK violation on create", async () => {
    mockTx.shiftSession.findUnique.mockResolvedValueOnce(null);
    mockTx.order.create.mockRejectedValueOnce(foreignKeyError());

    const results = await repo.syncOrderRecords([baseRecord]);

    expect(results).toEqual([{ order_id: "order-1", sync_status: "failed", synced_at: null }]);
  });

  it("rethrows unexpected errors instead of reporting the record as failed", async () => {
    mockTx.order.create.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));

    await expect(repo.syncOrderRecords([baseRecord])).rejects.toThrow("connect ECONNREFUSED");
  });

  it("marks a record as failed when a line item's product/modifier has no seeded recipe", async () => {
    mockTx.recipe.findMany.mockResolvedValueOnce([]);

    const results = await repo.syncOrderRecords([baseRecord]);

    expect(results).toEqual([{ order_id: "order-1", sync_status: "failed", synced_at: null }]);
  });

  it("decrements stock for every recipe ingredient consumed by each line item", async () => {
    mockTx.recipe.findMany.mockResolvedValueOnce([{ recipe_id: 7 }]);
    mockTx.recipeIngredient.findMany.mockResolvedValueOnce([
      { item_id: 10, quantity: { times: (n: number) => `18*${n}` } },
    ]);

    await repo.syncOrderRecords([baseRecord]);

    expect(mockTx.inventoryItem.update).toHaveBeenCalledWith({
      where: { item_id: 10 },
      data: { current_stock: { decrement: "18*2" } },
    });
  });

  it("processes each record in the batch independently — one failure doesn't affect the others", async () => {
    mockTx.order.create.mockResolvedValueOnce({}).mockRejectedValueOnce(foreignKeyError());

    const results = await repo.syncOrderRecords([baseRecord, { ...baseRecord, order_id: "order-2" }]);

    expect(results).toEqual([
      { order_id: "order-1", sync_status: "synced", synced_at: expect.any(Date) },
      { order_id: "order-2", sync_status: "failed", synced_at: null },
    ]);
  });

  it("fails every record tied to a closed session while records for a still-open session succeed, in the same batch", async () => {
    mockTx.shiftSession.findUnique.mockImplementation(({ where }: { where: { session_id: string } }) =>
      Promise.resolve(
        where.session_id === "closed-session" ? { end_time: new Date("2026-08-01T12:00:00Z") } : { end_time: null },
      ),
    );

    const results = await repo.syncOrderRecords([
      { ...baseRecord, order_id: "order-1", session_id: "closed-session" },
      { ...baseRecord, order_id: "order-2", session_id: "open-session" },
      { ...baseRecord, order_id: "order-3", session_id: "closed-session" },
    ]);

    expect(results).toEqual([
      { order_id: "order-1", sync_status: "failed", synced_at: null },
      { order_id: "order-2", sync_status: "synced", synced_at: expect.any(Date) },
      { order_id: "order-3", sync_status: "failed", synced_at: null },
    ]);
    // both closed-session records short-circuit before order.create; only the open one reaches it
    expect(mockTx.order.create).toHaveBeenCalledTimes(1);
  });

  it("defaults transaction_type/order_type/status/cash_tendered/change_given/completed_at when omitted", async () => {
    const record: OrderSyncRecord = {
      order_id: "order-1",
      session_id: "session-1",
      total_due: 5000,
      created_at: new Date("2026-08-01T10:00:00Z"),
      line_items: [],
    };

    await repo.syncOrderRecords([record]);

    expect(mockTx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        transaction_type: "sale",
        order_type: null,
        status: "completed",
        cash_tendered: null,
        change_given: null,
        completed_at: null,
      }),
    });
  });

  it("passes an empty line_items array through as an empty nested create", async () => {
    await repo.syncOrderRecords([{ ...baseRecord, line_items: [] }]);

    expect(mockTx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ line_items: { create: [] } }),
    });
  });
});
