import { ManagerLoginSchema } from "@/types/manager-login";

describe("ManagerLoginSchema", () => {
  it("accepts a valid username/password pair", () => {
    const result = ManagerLoginSchema.safeParse({ username: "jdoe", password: "Hunter2!" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing username", () => {
    const result = ManagerLoginSchema.safeParse({ password: "Hunter2!" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing password", () => {
    const result = ManagerLoginSchema.safeParse({ username: "jdoe" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty username", () => {
    const result = ManagerLoginSchema.safeParse({ username: "", password: "Hunter2!" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = ManagerLoginSchema.safeParse({ username: "jdoe", password: "" });
    expect(result.success).toBe(false);
  });

  it("does not enforce the manager password complexity policy on login", () => {
    const result = ManagerLoginSchema.safeParse({ username: "jdoe", password: "weak" });
    expect(result.success).toBe(true);
  });

  it("rejects a username containing HTML/SQL injection metacharacters", () => {
    const result = ManagerLoginSchema.safeParse({ username: "jdoe<script>", password: "Hunter2!" });
    expect(result.success).toBe(false);
  });

  it("does not restrict the password character set — it's hashed, never rendered or queried", () => {
    const result = ManagerLoginSchema.safeParse({ username: "jdoe", password: "p@ss'\"<>;word" });
    expect(result.success).toBe(true);
  });
});
