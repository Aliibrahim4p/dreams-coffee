import { signManagerToken, verifyManagerToken } from "@/lib/jwt";

describe("signManagerToken / verifyManagerToken", () => {
  it("round-trips a valid token", () => {
    const { token, expiresAt } = signManagerToken(42, 3600);

    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const payload = verifyManagerToken(token);
    expect(payload).toEqual({ manager_id: 42, exp: expect.any(Number) });
  });

  it("returns null for a tampered payload", () => {
    const { token } = signManagerToken(42, 3600);
    const [header, , signature] = token.split(".");
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const tamperedPayload = Buffer.from(JSON.stringify({ manager_id: 999, exp })).toString(
      "base64url",
    );

    expect(verifyManagerToken(`${header}.${tamperedPayload}.${signature}`)).toBeNull();
  });

  it("returns null for a token signed with a different secret", () => {
    const { token } = signManagerToken(42, 3600);
    const originalSecret = process.env.MANAGER_JWT_SECRET;
    process.env.MANAGER_JWT_SECRET = "a-different-secret";

    expect(verifyManagerToken(token)).toBeNull();

    process.env.MANAGER_JWT_SECRET = originalSecret;
  });

  it("returns null for an expired token", () => {
    const { token } = signManagerToken(42, -10);

    expect(verifyManagerToken(token)).toBeNull();
  });

  it("returns null for a malformed token", () => {
    expect(verifyManagerToken("not-a-token")).toBeNull();
    expect(verifyManagerToken("a.b")).toBeNull();
  });
});
