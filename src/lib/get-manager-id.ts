import UnauthorizedException from "@/exceptions/unauthorized-exception";

const MANAGER_ID_HEADER = "x-manager-id";

/**
 * Reads the manager id the proxy attaches to a request after verifying the
 * X-Manager-Token. Should always be present on a managerToken-gated route —
 * this only throws if the route is somehow reached without going through
 * the proxy (e.g. a direct call in a test).
 */
export function getManagerId(req: Request): number {
  const header = req.headers.get(MANAGER_ID_HEADER);
  const managerId = header !== null ? Number(header) : NaN;
  if (!Number.isInteger(managerId)) {
    throw new UnauthorizedException("Manager authentication required");
  }
  return managerId;
}
