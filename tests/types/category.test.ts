import { CategoryValidationSchema } from "@/types/category";

describe("CategoryValidationSchema", () => {
  it("accepts a valid name", () => {
    const result = CategoryValidationSchema.safeParse({ name: "Coffee" });
    expect(result.success).toBe(true);
  });

  it("accepts a name at the 40 character boundary", () => {
    const result = CategoryValidationSchema.safeParse({ name: "a".repeat(40) });
    expect(result.success).toBe(true);
  });

  it("rejects a name over 40 characters", () => {
    const result = CategoryValidationSchema.safeParse({ name: "a".repeat(41) });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = CategoryValidationSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const result = CategoryValidationSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a non-string name", () => {
    const result = CategoryValidationSchema.safeParse({ name: 123 });
    expect(result.success).toBe(false);
  });
});
