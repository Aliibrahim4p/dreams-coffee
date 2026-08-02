import { timingSafeEqual } from "crypto";

/**
 * The Manager Panel token is a static shared secret, not a signed/expiring token —
 * gate-only, carries no identity, same trust level as the PIN itself (AUTH-GATE-01).
 * Handed to the client after a correct PIN so it can be reused for panel-gated
 * actions, including local FE-only checks, without a network round trip each time.
 */
function getPanelSecret(): string {
  const secret = process.env.PANEL_SECRET_KEY;
  if (!secret) {
    throw new Error("PANEL_SECRET_KEY is not set");
  }
  return secret;
}

/** The raw secret to hand back to the client after a correct PIN — this IS the panel_token. */
export function issuePanelToken(): string {
  return getPanelSecret();
}

/** Compares a candidate X-Panel-Token against PANEL_SECRET_KEY. */
export function verifyPanelSecret(candidate: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(getPanelSecret());
  return (
    candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}
