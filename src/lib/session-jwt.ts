import { createHmac, timingSafeEqual } from "crypto";

export type SessionTokenPayload = { session_id: string; exp: number };

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

export function signSessionToken(
  sessionId: string,
  expiresInSeconds: number,
): { token: string; expiresAt: Date } {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = encode({ session_id: sessionId, exp });
  const signature = sign(`${header}.${payload}`);
  return { token: `${header}.${payload}.${signature}`, expiresAt: new Date(exp * 1000) };
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

  if (typeof parsed.session_id !== "string" || typeof parsed.exp !== "number") {
    return null;
  }
  if (parsed.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return parsed;
}
