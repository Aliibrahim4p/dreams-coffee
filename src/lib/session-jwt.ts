import { createHmac, timingSafeEqual } from "crypto";

export type SessionTokenPayload = { session_id: string };

function getSecret(): string {
  const secret = process.env.SESSION_JWT_SECRET;
  if (!secret) {
    throw new Error("SESSION_JWT_SECRET is not set");
  }
  return secret;
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(headerAndPayload: string): string {
  return createHmac("sha256", getSecret()).update(headerAndPayload).digest("base64url");
}

/**
 * No exp claim: per the contract, X-Session-Token is valid until cash-out sets
 * end_time — the proxy's live isOpenSession check is the whole expiry check,
 * not a TTL on the token itself (a shift can run longer than any fixed TTL).
 */
export function signSessionToken(sessionId: string): { token: string } {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ session_id: sessionId });
  const signature = sign(`${header}.${payload}`);
  return { token: `${header}.${payload}.${signature}` };
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;

  const expectedSignature = sign(`${header}.${payload}`);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  let parsed: SessionTokenPayload;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof parsed.session_id !== "string") {
    return null;
  }

  return parsed;
}
