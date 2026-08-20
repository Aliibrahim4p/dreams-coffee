import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyManagerToken } from "@/lib/jwt";
import { verifyAdminToken } from "@/lib/admin-jwt";
import { ManagerRepository } from "@/repository/manager-repository";

const MANAGER_TOKEN_HEADER = "x-manager-token";
const MANAGER_ID_HEADER = "x-manager-id";
const ADMIN_TOKEN_HEADER = "x-admin-token";

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

function isPublicRoute(method: string, pathname: string): boolean {
  if (pathname.startsWith("/api/auth/")) return true;
  return PUBLIC_ROUTES.some((route) => route.method === method && route.pattern.test(pathname));
}

function matchesAdminRoute(method: string, pathname: string): boolean {
  return ADMIN_ROUTES.some((route) => route.method === method && route.pattern.test(pathname));
}

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicRoute(request.method, pathname)) {
    return NextResponse.next();
  }

  if (matchesAdminRoute(request.method, pathname)) {
    const adminToken = request.headers.get(ADMIN_TOKEN_HEADER);
    if (!adminToken || !verifyAdminToken(adminToken)) {
      return unauthorized("Admin authentication required");
    }
    return NextResponse.next();
  }

  const token = request.headers.get(MANAGER_TOKEN_HEADER);
  if (!token) {
    return unauthorized("Manager authentication required");
  }

  const payload = verifyManagerToken(token);
  if (!payload) {
    return unauthorized("Invalid or expired manager token");
  }

  const isActive = await new ManagerRepository().isActiveManager(payload.manager_id);
  if (!isActive) {
    return unauthorized("Invalid or expired manager token");
  }

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(MANAGER_ID_HEADER, String(payload.manager_id));

  return NextResponse.next({ request: { headers: forwardedHeaders } });
}

export const config = {
  matcher: "/api/:path*",
};
