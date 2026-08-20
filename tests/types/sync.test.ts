import { OrderSyncRecordSchema, SyncRecordsRequestSchema } from "@/types/sync";

const validRecord = {
  order_id: "order-1",
  session_id: "session-1",
  total_due: 5000,
  created_at: "2026-08-01T10:00:00Z",
  line_items: [{ product_id: 1, quantity: 2, unit_price: 2500 }],
};

describe("OrderSyncRecordSchema", () => {
  it("accepts a minimal open order", () => {
    const result = OrderSyncRecordSchema.safeParse(validRecord);
    expect(result.success).toBe(true);
  });

  it("accepts a completed order with completed_at set", () => {
    const result = OrderSyncRecordSchema.safeParse({
      ...validRecord,
      status: "completed",
      completed_at: "2026-08-01T10:05:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a completed order without completed_at", () => {
    const result = OrderSyncRecordSchema.safeParse({
      ...validRecord,
      status: "completed",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive line item quantity", () => {
    const result = OrderSyncRecordSchema.safeParse({
      ...validRecord,
      line_items: [{ product_id: 1, quantity: 0, unit_price: 2500 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative unit_price", () => {
    const result = OrderSyncRecordSchema.safeParse({
      ...validRecord,
      line_items: [{ product_id: 1, quantity: 1, unit_price: -1 }],
    });
    expect(result.success).toBe(false);
  });

  it("allows an empty line_items array (an opened but still-empty basket)", () => {
    const result = OrderSyncRecordSchema.safeParse({ ...validRecord, line_items: [] });
    expect(result.success).toBe(true);
  });

  it("allows a negative total_due (refunds)", () => {
    const result = OrderSyncRecordSchema.safeParse({ ...validRecord, total_due: -5000 });
    expect(result.success).toBe(true);
  });

  it("rejects a missing created_at", () => {
    const { created_at, ...rest } = validRecord;
    void created_at;
    const result = OrderSyncRecordSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("accepts change_given that correctly equals cash_tendered - total_due", () => {
    const result = OrderSyncRecordSchema.safeParse({
      ...validRecord,
      cash_tendered: 5500,
      change_given: 500,
    });
    expect(result.success).toBe(true);
  });

  it("allows cash_tendered/change_given to both be absent (non-cash payment)", () => {
    const result = OrderSyncRecordSchema.safeParse(validRecord);
    expect(result.success).toBe(true);
  });

  it("does not require change_given when cash_tendered is present but the tender is exact", () => {
    const result = OrderSyncRecordSchema.safeParse({ ...validRecord, cash_tendered: 5000 });
    expect(result.success).toBe(true);
  });
});

describe("SyncRecordsRequestSchema", () => {
  it("accepts a batch of one or more records", () => {
    const result = SyncRecordsRequestSchema.safeParse({ records: [validRecord] });
    expect(result.success).toBe(true);
  });

  it("rejects an empty batch", () => {
    const result = SyncRecordsRequestSchema.safeParse({ records: [] });
    expect(result.success).toBe(false);
  });
});
