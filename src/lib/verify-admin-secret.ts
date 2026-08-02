import { timingSafeEqual } from "crypto";

function getAdminSecret(): string {
  const secret = process.env.ADMIN_SECRET_KEY;
  if (!secret) {
    throw new Error("ADMIN_SECRET_KEY is not set");
  }
  return secret;
}

/** Compares a candidate admin key against ADMIN_SECRET_KEY — used only by admin login. */
export function verifyAdminSecret(candidate: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(getAdminSecret());
  return (
    candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}
