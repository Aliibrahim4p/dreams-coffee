jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    order: { create: jest.fn() },
  },
}));

import prisma from "@/lib/db";
import { SyncRepository } from "@/repository/sync-repository";
import { OrderSyncRecord } from "@/types/sync";

const db = prisma as unknown as {
  order: { create: jest.Mock };
};

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
    db.order.create.mockResolvedValue({});
  });

  it("inserts the order with nested line items, returning synced status", async () => {
    const results = await repo.syncOrderRecords([baseRecord]);

    expect(db.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        order_id: "order-1",
        session_id: "session-1",
        sync_status: "synced",
        line_items: { create: [{ product_id: 1, modifier_id: 2, quantity: 2, unit_price: 2500 }] },
      }),
    });
    expect(results).toEqual([{ order_id: "order-1", sync_status: "synced", synced_at: expect.any(Date) }]);
  });

  it("marks a record as failed when create throws (bad session_id/product_id/modifier_id, or a duplicate order_id)", async () => {
    db.order.create.mockRejectedValueOnce(new Error("Foreign key constraint failed"));

    const results = await repo.syncOrderRecords([baseRecord]);

    expect(results).toEqual([{ order_id: "order-1", sync_status: "failed", synced_at: null }]);
  });

  it("processes each record in the batch independently — one failure doesn't affect the others", async () => {
    db.order.create.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("bad fk"));

    const results = await repo.syncOrderRecords([baseRecord, { ...baseRecord, order_id: "order-2" }]);

    expect(results).toEqual([
      { order_id: "order-1", sync_status: "synced", synced_at: expect.any(Date) },
      { order_id: "order-2", sync_status: "failed", synced_at: null },
    ]);
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

    expect(db.order.create).toHaveBeenCalledWith({
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

    expect(db.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ line_items: { create: [] } }),
    });
  });
});
