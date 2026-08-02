import { DeliveryCreateSchema } from "@/types/delivery";

const validLineItem = { item_id: 1, config_id: 1, qty_received: 2, total_cost: 10000 };

describe("DeliveryCreateSchema", () => {
  it("accepts a valid delivery", () => {
    const result = DeliveryCreateSchema.safeParse({
      supplier_id: 1,
      line_items: [validLineItem],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty line_items array", () => {
    const result = DeliveryCreateSchema.safeParse({
      supplier_id: 1,
      line_items: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive qty_received", () => {
    const result = DeliveryCreateSchema.safeParse({
      supplier_id: 1,
      line_items: [{ ...validLineItem, qty_received: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("does not accept a client-supplied date_received (server-derived instead)", () => {
    const result = DeliveryCreateSchema.safeParse({
      supplier_id: 1,
      date_received: "2026-07-31",
      line_items: [validLineItem],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).date_received).toBeUndefined();
    }
  });
});
