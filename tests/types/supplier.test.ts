import { SupplierCreateSchema, SupplierUpdateSchema } from "@/types/supplier";

describe("SupplierCreateSchema", () => {
  it("accepts a valid name", () => {
    expect(SupplierCreateSchema.safeParse({ name: "Acme" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(SupplierCreateSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects a missing name", () => {
    expect(SupplierCreateSchema.safeParse({}).success).toBe(false);
  });
});

describe("SupplierUpdateSchema", () => {
  it("requires a name", () => {
    expect(SupplierUpdateSchema.safeParse({}).success).toBe(false);
  });
});
