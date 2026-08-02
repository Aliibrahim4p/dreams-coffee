import { signSessionToken, verifySessionToken } from "@/lib/session-jwt";
import { signManagerToken } from "@/lib/jwt";

describe("signSessionToken / verifySessionToken", () => {
  it("round-trips a valid token", () => {
    const { token, expiresAt } = signSessionToken("session-1", 3600);

    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const payload = verifySessionToken(token);
    expect(payload).toEqual({ session_id: "session-1", exp: expect.any(Number) });
  });

  it("returns null for a tampered payload", () => {
    const { token } = signSessionToken("session-1", 3600);
    const [header, , signature] = token.split(".");
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const tamperedPayload = Buffer.from(JSON.stringify({ session_id: "session-2", exp })).toString(
      "base64url",
    );

    expect(verifySessionToken(`${header}.${tamperedPayload}.${signature}`)).toBeNull();
  });

  it("returns null for a token signed with a different secret", () => {
    const { token } = signSessionToken("session-1", 3600);
    const originalSecret = process.env.SESSION_JWT_SECRET;
    process.env.SESSION_JWT_SECRET = "a-different-secret";

    expect(verifySessionToken(token)).toBeNull();

    process.env.SESSION_JWT_SECRET = originalSecret;
  });

  it("returns null for an expired token", () => {
    const { token } = signSessionToken("session-1", -10);

    expect(verifySessionToken(token)).toBeNull();
  });

  it("returns null for a malformed token", () => {
    expect(verifySessionToken("not-a-token")).toBeNull();
    expect(verifySessionToken("a.b")).toBeNull();
  });

  it("a manager token is never accepted as a session token", () => {
    const { token } = signManagerToken(1, 3600);

    expect(verifySessionToken(token)).toBeNull();
  });
});
