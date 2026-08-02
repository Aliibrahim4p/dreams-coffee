import { InventoryItemCreateSchema } from "@/types/inventory-item";

describe("InventoryItemCreateSchema", () => {
  it("accepts a valid item", () => {
    const result = InventoryItemCreateSchema.safeParse({
      name: "Milk",
      unit: "ml",
      count_frequency: "daily",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid unit", () => {
    const result = InventoryItemCreateSchema.safeParse({
      name: "Milk",
      unit: "liters",
      count_frequency: "daily",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid count_frequency", () => {
    const result = InventoryItemCreateSchema.safeParse({
      name: "Milk",
      unit: "ml",
      count_frequency: "weekly",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const result = InventoryItemCreateSchema.safeParse({ unit: "ml", count_frequency: "daily" });
    expect(result.success).toBe(false);
  });
});
