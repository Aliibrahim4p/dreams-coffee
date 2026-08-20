import { signAdminToken, verifyAdminToken } from "@/lib/admin-jwt";
import { signManagerToken } from "@/lib/jwt";

describe("signAdminToken / verifyAdminToken", () => {
  it("round-trips a valid token", () => {
    const { token, expiresAt } = signAdminToken(3600);

    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const payload = verifyAdminToken(token);
    expect(payload).toEqual({ role: "admin", exp: expect.any(Number) });
  });

  it("returns null for a tampered payload", () => {
    const { token } = signAdminToken(3600);
    const [header, , signature] = token.split(".");
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const tamperedPayload = Buffer.from(JSON.stringify({ role: "admin", exp: exp + 999999 })).toString(
      "base64url",
    );

    expect(verifyAdminToken(`${header}.${tamperedPayload}.${signature}`)).toBeNull();
  });

  it("returns null for a token signed with a different secret", () => {
    const { token } = signAdminToken(3600);
    const originalSecret = process.env.ADMIN_JWT_SECRET;
    process.env.ADMIN_JWT_SECRET = "a-different-secret";

    expect(verifyAdminToken(token)).toBeNull();

    process.env.ADMIN_JWT_SECRET = originalSecret;
  });

  it("returns null for an expired token", () => {
    const { token } = signAdminToken(-10);

    expect(verifyAdminToken(token)).toBeNull();
  });

  it("returns null for a malformed token", () => {
    expect(verifyAdminToken("not-a-token")).toBeNull();
    expect(verifyAdminToken("a.b")).toBeNull();
  });

  it("a manager token is never accepted as an admin token", () => {
    const { token } = signManagerToken(1, 3600);

    expect(verifyAdminToken(token)).toBeNull();
  });
});
