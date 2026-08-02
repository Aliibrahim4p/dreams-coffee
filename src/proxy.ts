import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyManagerToken } from "@/lib/jwt";
import { verifyAdminToken } from "@/lib/admin-jwt";
import { verifyPanelSecret } from "@/lib/panel-secret";
import { verifySessionToken } from "@/lib/session-jwt";
import { ManagerRepository } from "@/repository/manager-repository";
import { ShiftSessionRepository } from "@/repository/shift-session-repository";
import logger from "@/util/logger";

const MANAGER_TOKEN_HEADER = "x-manager-token";
const MANAGER_ID_HEADER = "x-manager-id";
const ADMIN_TOKEN_HEADER = "x-admin-token";
const PANEL_TOKEN_HEADER = "x-panel-token";
const SESSION_TOKEN_HEADER = "x-session-token";
const SESSION_ID_HEADER = "x-session-id";

/**
 * Catalog-browsing GETs the contract gates behind activeSession (POS terminal
 * session), not managerToken. That auth doesn't exist yet, so these stay open
 * rather than being folded into the managerToken check below.
 */
const PUBLIC_ROUTES: Array<{ method: string; pattern: RegExp }> = [
  { method: "GET", pattern: /^\/api\/sync\/heartbeat$/ },
  { method: "GET", pattern: /^\/api\/categories$/ },
  { method: "GET", pattern: /^\/api\/categories\/[^/]+\/products$/ },
  { method: "GET", pattern: /^\/api\/products\/[^/]+\/sizes$/ },
  { method: "GET", pattern: /^\/api\/products\/[^/]+\/recipe$/ },
  { method: "GET", pattern: /^\/api\/config\/exchange-rate$/ },
];

/**
 * Admin-only routes: provisioning/managing managers and building/editing recipes.
 * Gated exclusively by X-Admin-Token (issued by POST /api/auth/admin/login) —
 * never combined with a manager token, and never treated as a public route
 * either. A regular manager token grants no access here at all — otherwise any
 * manager could edit or deactivate any other manager's account.
 */
const ADMIN_ROUTES: Array<{ method: string; pattern: RegExp }> = [
  { method: "POST", pattern: /^\/api\/managers$/ },
  { method: "PATCH", pattern: /^\/api\/managers\/[^/]+$/ },
  { method: "DELETE", pattern: /^\/api\/managers\/[^/]+$/ },
  { method: "POST", pattern: /^\/api\/products\/[^/]+\/recipe$/ },
  { method: "PATCH", pattern: /^\/api\/products\/[^/]+\/recipe\/[^/]+$/ },
];

/**
 * Panel-only: opening a new cashier shift. Gated by X-Panel-Token alone — the
 * contract also lists activeSession here, but that can't be a real requirement
 * for the endpoint that creates the very first session of the day (nothing to
 * hold a session token for yet). activeSession genuinely applies to every other
 * panel action (cash-out, void, clear, refund), which operate on a session that
 * already exists.
 *
 * Also covers the recovery cash-out (POST /shift-sessions/current/cash-out): a
 * panel-token holder closing whatever session is currently open without needing
 * its session_token — for a device that lost its stored token, or just clearing
 * seeded/stuck state. Single-terminal deployment, so "current" is unambiguous.
 */
const PANEL_ROUTES: Array<{ method: string; pattern: RegExp }> = [
  { method: "POST", pattern: /^\/api\/shift-sessions$/ },
  { method: "POST", pattern: /^\/api\/shift-sessions\/current\/cash-out$/ },
];

/**
 * activeSession + panelToken together: closing a session that's already open —
 * by its own session_token, not the "current" recovery path above (excluded here
 * so the two routes can't both match the same request).
 */
const SESSION_AND_PANEL_ROUTES: Array<{ method: string; pattern: RegExp }> = [
  { method: "POST", pattern: /^\/api\/shift-sessions\/(?!current\/)[^/]+\/cash-out$/ },
];

/**
 * Everything under /api/auth/ — including PIN verify — is reachable with no prior
 * token. PIN verify must be a cold-start entry point: it's the only way to obtain
 * a panel_token, which is in turn the only way to open the first shift session of
 * the day, so it can never itself require an activeSession without deadlocking
 * (there would be no way to ever get one). Its own PIN check (scrypt-hashed,
 * compared same as a manager password) is the real security boundary, same as
 * the shared secret on /api/auth/admin/login.
 */
function isPublicRoute(method: string, pathname: string): boolean {
  if (pathname.startsWith("/api/auth/")) return true;
  return PUBLIC_ROUTES.some((route) => route.method === method && route.pattern.test(pathname));
}

function matchesAdminRoute(method: string, pathname: string): boolean {
  return ADMIN_ROUTES.some((route) => route.method === method && route.pattern.test(pathname));
}

function matchesPanelRoute(method: string, pathname: string): boolean {
  return PANEL_ROUTES.some((route) => route.method === method && route.pattern.test(pathname));
}

function matchesSessionAndPanelRoute(method: string, pathname: string): boolean {
  return SESSION_AND_PANEL_ROUTES.some((route) => route.method === method && route.pattern.test(pathname));
}

function unauthorized(method: string, pathname: string, message: string) {
  logger.warn("401 %s %s: %s", method, pathname, message);
  return NextResponse.json({ error: message }, { status: 401 });
}

/** Verifies X-Session-Token: signature/expiry, then a live end_time=null check — same shape as the manager token's live is_active check. */
async function resolveSessionId(request: NextRequest): Promise<string | null> {
  const token = request.headers.get(SESSION_TOKEN_HEADER);
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  const isOpen = await new ShiftSessionRepository().isOpenSession(payload.session_id);
  if (!isOpen) return null;

  return payload.session_id;
}

function forwardSessionId(request: NextRequest, sessionId: string) {
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(SESSION_ID_HEADER, sessionId);
  return NextResponse.next({ request: { headers: forwardedHeaders } });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  logger.info("%s %s", method, pathname);

  if (matchesAdminRoute(method, pathname)) {
    const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
    if (!adminToken || !verifyAdminToken(adminToken)) {
      return unauthorized(method, pathname, "Admin authentication required");
    }
    return NextResponse.next();
  }

  if (matchesSessionAndPanelRoute(method, pathname)) {
    const sessionId = await resolveSessionId(request);
    if (!sessionId) {
      return unauthorized(method, pathname, "Active session required");
    }
    const panelToken = request.headers.get(PANEL_TOKEN_HEADER);
    if (!panelToken || !verifyPanelSecret(panelToken)) {
      return unauthorized(method, pathname, "Panel access required");
    }
    return forwardSessionId(request, sessionId);
  }

  if (matchesPanelRoute(method, pathname)) {
    const panelToken = request.headers.get(PANEL_TOKEN_HEADER);
    if (!panelToken || !verifyPanelSecret(panelToken)) {
      return unauthorized(method, pathname, "Panel access required");
    }
    return NextResponse.next();
  }

  if (isPublicRoute(method, pathname)) {
    return NextResponse.next();
  }

  const token = request.headers.get(MANAGER_TOKEN_HEADER);
  if (!token) {
    return unauthorized(method, pathname, "Manager authentication required");
  }

  const payload = verifyManagerToken(token);
  if (!payload) {
    return unauthorized(method, pathname, "Invalid or expired manager token");
  }

  const isActive = await new ManagerRepository().isActiveManager(payload.manager_id);
  if (!isActive) {
    return unauthorized(method, pathname, "Invalid or expired manager token");
  }

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(MANAGER_ID_HEADER, String(payload.manager_id));

  return NextResponse.next({ request: { headers: forwardedHeaders } });
}

export const config = {
  matcher: "/api/:path*",
};
