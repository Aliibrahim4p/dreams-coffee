import { ProductCreateSchema, ProductUpdateSchema } from "@/types/product";

describe("ProductCreateSchema", () => {
  it("accepts a valid recipe_based product", () => {
    const result = ProductCreateSchema.safeParse({
      category_id: 1,
      name: "Latte",
      type: "recipe_based",
      base_price: 50000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid type", () => {
    const result = ProductCreateSchema.safeParse({
      category_id: 1,
      name: "Latte",
      type: "bogus",
      base_price: 50000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative base_price", () => {
    const result = ProductCreateSchema.safeParse({
      category_id: 1,
      name: "Latte",
      type: "reseller",
      base_price: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const result = ProductCreateSchema.safeParse({
      category_id: 1,
      type: "reseller",
      base_price: 1000,
    });
    expect(result.success).toBe(false);
  });
});

describe("ProductUpdateSchema", () => {
  it("accepts a partial update with a single field", () => {
    const result = ProductUpdateSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty object", () => {
    const result = ProductUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
