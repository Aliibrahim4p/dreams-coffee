import { EmployeeCreateSchema, EmployeeUpdateSchema } from "@/types/employee";

describe("EmployeeCreateSchema", () => {
  it("accepts a valid employee", () => {
    const result = EmployeeCreateSchema.safeParse({
      pos_id: 101,
      first_name: "Jane",
      last_name: "Doe",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing pos_id", () => {
    const result = EmployeeCreateSchema.safeParse({ first_name: "Jane", last_name: "Doe" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty first_name", () => {
    const result = EmployeeCreateSchema.safeParse({ pos_id: 101, first_name: "", last_name: "Doe" });
    expect(result.success).toBe(false);
  });
});

describe("EmployeeUpdateSchema", () => {
  it("accepts a partial update", () => {
    const result = EmployeeUpdateSchema.safeParse({ first_name: "Janet" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty object", () => {
    const result = EmployeeUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
