import { AdminLoginSchema } from "@/types/admin-login";

describe("AdminLoginSchema", () => {
  it("accepts a valid admin_key", () => {
    expect(AdminLoginSchema.safeParse({ admin_key: "shared-secret-123" }).success).toBe(true);
  });

  it("rejects a missing admin_key", () => {
    expect(AdminLoginSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an empty admin_key", () => {
    expect(AdminLoginSchema.safeParse({ admin_key: "" }).success).toBe(false);
  });

  it("rejects an admin_key containing injection metacharacters", () => {
    expect(AdminLoginSchema.safeParse({ admin_key: "key<script>alert(1)</script>" }).success).toBe(false);
  });
});
