import { hashPassword, verifyPassword } from "@/lib/password";

describe("hashPassword", () => {
  it("returns a salt:hash string different from the plaintext", async () => {
    const hashed = await hashPassword("hunter2");
    expect(hashed).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(hashed).not.toContain("hunter2");
  });

  it("produces a different hash each time due to random salt", async () => {
    const first = await hashPassword("hunter2");
    const second = await hashPassword("hunter2");
    expect(first).not.toEqual(second);
  });
});

describe("verifyPassword", () => {
  it("returns true for the correct password", async () => {
    const hashed = await hashPassword("Hunter2!");
    await expect(verifyPassword("Hunter2!", hashed)).resolves.toBe(true);
  });

  it("returns false for an incorrect password", async () => {
    const hashed = await hashPassword("Hunter2!");
    await expect(verifyPassword("WrongPass1!", hashed)).resolves.toBe(false);
  });

  it("returns false for a malformed stored hash", async () => {
    await expect(verifyPassword("Hunter2!", "not-a-valid-hash")).resolves.toBe(false);
  });
});
