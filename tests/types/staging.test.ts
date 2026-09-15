import { StagingOrderRecordSchema, StagingRequestSchema } from "@/types/staging";

const validRecord = {
  order_id: "order-1",
  session_id: "session-1",
  order_type: "dine_in",
  created_at: "2026-08-01T10:00:00Z",
  line_items: [{ product_id: 1, unit_price: 5000 }],
};

describe("StagingOrderRecordSchema", () => {
  it("accepts a valid sale with order_type set", () => {
    expect(StagingOrderRecordSchema.safeParse(validRecord).success).toBe(true);
  });

  it("accepts a sale with order_type omitted — that cross-field rule is checked at process time, not here", () => {
    const { order_type, ...rest } = validRecord;
    void order_type;
    expect(StagingOrderRecordSchema.safeParse(rest).success).toBe(true);
  });

  it("accepts a sale with order_type explicitly null — checked at process time, not here", () => {
    const result = StagingOrderRecordSchema.safeParse({ ...validRecord, order_type: null });
    expect(result.success).toBe(true);
  });

  it("accepts a refund with order_type null", () => {
    const result = StagingOrderRecordSchema.safeParse({
      ...validRecord,
      transaction_type: "refund",
      order_type: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a refund with order_type omitted", () => {
    const { order_type, ...rest } = validRecord;
    void order_type;
    const result = StagingOrderRecordSchema.safeParse({ ...rest, transaction_type: "refund" });
    expect(result.success).toBe(true);
  });

  it("accepts a refund with order_type set to dine_in or take_out — checked at process time, not here", () => {
    const result = StagingOrderRecordSchema.safeParse({
      ...validRecord,
      transaction_type: "refund",
      order_type: "dine_in",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid order_type value", () => {
    const result = StagingOrderRecordSchema.safeParse({ ...validRecord, order_type: "delivery" });
    expect(result.success).toBe(false);
  });

  it("rejects a completed order without completed_at", () => {
    const result = StagingOrderRecordSchema.safeParse({ ...validRecord, status: "completed" });
    expect(result.success).toBe(false);
  });

  it("accepts a completed order with completed_at set", () => {
    const result = StagingOrderRecordSchema.safeParse({
      ...validRecord,
      status: "completed",
      completed_at: "2026-08-01T10:05:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a line_items array missing unit_price", () => {
    const result = StagingOrderRecordSchema.safeParse({
      ...validRecord,
      line_items: [{ product_id: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty line_items array", () => {
    const result = StagingOrderRecordSchema.safeParse({ ...validRecord, line_items: [] });
    expect(result.success).toBe(false);
  });
});

describe("StagingRequestSchema", () => {
  it("accepts a batch of one or more records", () => {
    expect(StagingRequestSchema.safeParse({ records: [validRecord] }).success).toBe(true);
  });

  it("rejects an empty batch", () => {
    expect(StagingRequestSchema.safeParse({ records: [] }).success).toBe(false);
  });
});
