import { verifyAdminSecret } from "@/lib/verify-admin-secret";

describe("verifyAdminSecret", () => {
  it("returns true for the correct secret", () => {
    expect(verifyAdminSecret(process.env.ADMIN_SECRET_KEY as string)).toBe(true);
  });

  it("returns false for a wrong secret", () => {
    expect(verifyAdminSecret("definitely-wrong")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(verifyAdminSecret("")).toBe(false);
  });

  it("throws when ADMIN_SECRET_KEY is not set", () => {
    const original = process.env.ADMIN_SECRET_KEY;
    delete process.env.ADMIN_SECRET_KEY;

    expect(() => verifyAdminSecret("anything")).toThrow("ADMIN_SECRET_KEY is not set");

    process.env.ADMIN_SECRET_KEY = original;
  });
});
