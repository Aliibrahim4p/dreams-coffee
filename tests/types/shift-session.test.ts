import { OpenShiftSessionSchema } from "@/types/shift-session";

describe("OpenShiftSessionSchema", () => {
  it("accepts a valid payload", () => {
    const result = OpenShiftSessionSchema.safeParse({ cashier_pos_id: 1, starting_float: 50000 });
    expect(result.success).toBe(true);
  });

  it("rejects a non-integer cashier_pos_id", () => {
    const result = OpenShiftSessionSchema.safeParse({ cashier_pos_id: 1.5, starting_float: 50000 });
    expect(result.success).toBe(false);
  });

  it("rejects starting_float = 0", () => {
    const result = OpenShiftSessionSchema.safeParse({ cashier_pos_id: 1, starting_float: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative starting_float", () => {
    const result = OpenShiftSessionSchema.safeParse({ cashier_pos_id: 1, starting_float: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a missing starting_float", () => {
    const result = OpenShiftSessionSchema.safeParse({ cashier_pos_id: 1 });
    expect(result.success).toBe(false);
  });
});
