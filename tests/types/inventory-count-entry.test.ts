import { InventoryCountEntryCreateSchema } from "@/types/inventory-count-entry";

describe("InventoryCountEntryCreateSchema", () => {
  it("accepts a valid entry", () => {
    const result = InventoryCountEntryCreateSchema.safeParse({
      item_id: 1,
      physical_count: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative physical_count", () => {
    const result = InventoryCountEntryCreateSchema.safeParse({
      item_id: 1,
      physical_count: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing item_id", () => {
    const result = InventoryCountEntryCreateSchema.safeParse({ physical_count: 10 });
    expect(result.success).toBe(false);
  });
});
