import { ManagerCreateSchema, ManagerUpdateSchema, PasswordSchema } from "@/types/manager";

const VALID_PASSWORD = "Hunter2!";

describe("ManagerCreateSchema", () => {
  it("accepts a valid manager", () => {
    const result = ManagerCreateSchema.safeParse({
      username: "jdoe",
      password: VALID_PASSWORD,
      first_name: "Jane",
      last_name: "Doe",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing password", () => {
    const result = ManagerCreateSchema.safeParse({
      username: "jdoe",
      first_name: "Jane",
      last_name: "Doe",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password that fails the complexity policy", () => {
    const result = ManagerCreateSchema.safeParse({
      username: "jdoe",
      password: "hunter2",
      first_name: "Jane",
      last_name: "Doe",
    });
    expect(result.success).toBe(false);
  });
});

describe("ManagerUpdateSchema", () => {
  it("accepts a partial update", () => {
    const result = ManagerUpdateSchema.safeParse({ password: VALID_PASSWORD });
    expect(result.success).toBe(true);
  });

  it("rejects an empty object", () => {
    const result = ManagerUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a weak password on update", () => {
    const result = ManagerUpdateSchema.safeParse({ password: "weak" });
    expect(result.success).toBe(false);
  });
});

describe("PasswordSchema", () => {
  it.each([
    ["Hunter2!", true],
    ["hunter2!", false], // no uppercase
    ["HUNTER2!", false], // no lowercase
    ["Hunterrr!", false], // no digit
    ["Hunter22", false], // no symbol
    ["H1!aaaaa", true],
    ["Sh0rt!", false], // under 8 characters
  ])("%s -> valid=%s", (password, expected) => {
    expect(PasswordSchema.safeParse(password).success).toBe(expected);
  });
});
