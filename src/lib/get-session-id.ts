import UnauthorizedException from "@/exceptions/unauthorized-exception";

const SESSION_ID_HEADER = "x-session-id";

/**
 * Reads the shift session id the proxy attaches to a request after verifying the
 * X-Session-Token. Should always be present on an activeSession-gated route —
 * this only throws if the route is somehow reached without going through
 * the proxy (e.g. a direct call in a test).
 */
export function getSessionId(req: Request): string {
  const header = req.headers.get(SESSION_ID_HEADER);
  if (!header) {
    throw new UnauthorizedException("Active session required");
  }
  return header;
}
