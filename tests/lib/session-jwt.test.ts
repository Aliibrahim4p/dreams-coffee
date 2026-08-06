import { signSessionToken, verifySessionToken } from "@/lib/session-jwt";
import { signManagerToken } from "@/lib/jwt";

describe("signSessionToken / verifySessionToken", () => {
  it("round-trips a valid token", () => {
    const { token } = signSessionToken("session-1");

    const payload = verifySessionToken(token);
    expect(payload).toEqual({ session_id: "session-1" });
  });

  it("returns null for a tampered payload", () => {
    const { token } = signSessionToken("session-1");
    const [header, , signature] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ session_id: "session-2" })).toString("base64url");

    expect(verifySessionToken(`${header}.${tamperedPayload}.${signature}`)).toBeNull();
  });

  it("returns null for a token signed with a different secret", () => {
    const { token } = signSessionToken("session-1");
    const originalSecret = process.env.SESSION_JWT_SECRET;
    process.env.SESSION_JWT_SECRET = "a-different-secret";

    expect(verifySessionToken(token)).toBeNull();

    process.env.SESSION_JWT_SECRET = originalSecret;
  });

  it("never expires — stays valid regardless of how much time has passed", () => {
    const { token } = signSessionToken("session-1");

    const payload = verifySessionToken(token);
    expect(payload).toEqual({ session_id: "session-1" });
    expect(payload).not.toHaveProperty("exp");
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
