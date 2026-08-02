jest.mock("@/lib/jwt");
jest.mock("@/lib/admin-jwt");
jest.mock("@/lib/panel-secret");
jest.mock("@/lib/session-jwt");
jest.mock("@/repository/manager-repository");
jest.mock("@/repository/shift-session-repository");

import { NextRequest } from "next/server";
import { verifyManagerToken } from "@/lib/jwt";
import { verifyAdminToken } from "@/lib/admin-jwt";
import { verifyPanelSecret } from "@/lib/panel-secret";
import { verifySessionToken } from "@/lib/session-jwt";
import { ManagerRepository } from "@/repository/manager-repository";
import { ShiftSessionRepository } from "@/repository/shift-session-repository";
import { proxy } from "@/proxy";

const mockedVerifyManagerToken = verifyManagerToken as jest.Mock;
const mockedVerifyAdminToken = verifyAdminToken as jest.Mock;
const mockedVerifyPanelSecret = verifyPanelSecret as jest.Mock;
const mockedVerifySessionToken = verifySessionToken as jest.Mock;
const MockedManagerRepository = ManagerRepository as jest.MockedClass<typeof ManagerRepository>;
const MockedShiftSessionRepository = ShiftSessionRepository as jest.MockedClass<typeof ShiftSessionRepository>;

function mockIsActiveManager(result: boolean) {
  const isActiveManager = jest.fn().mockResolvedValue(result);
  MockedManagerRepository.mockImplementation(
    () => ({ isActiveManager }) as unknown as ManagerRepository,
  );
  return isActiveManager;
}

function mockIsOpenSession(result: boolean) {
  const isOpenSession = jest.fn().mockResolvedValue(result);
  MockedShiftSessionRepository.mockImplementation(
    () => ({ isOpenSession }) as unknown as ShiftSessionRepository,
  );
  return isOpenSession;
}

function makeRequest(method: string, path: string, token?: string) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: token ? { "x-manager-token": token } : undefined,
  });
}

function makeAdminRequest(method: string, path: string, adminToken?: string) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: adminToken ? { "x-admin-token": adminToken } : undefined,
  });
}

function makePanelRequest(method: string, path: string, panelToken?: string) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: panelToken ? { "x-panel-token": panelToken } : undefined,
  });
}

function makeSessionRequest(
  method: string,
  path: string,
  sessionToken?: string,
  panelToken?: string,
) {
  const headers: Record<string, string> = {};
  if (sessionToken) headers["x-session-token"] = sessionToken;
  if (panelToken) headers["x-panel-token"] = panelToken;
  return new NextRequest(`http://localhost${path}`, { method, headers });
}

describe("proxy", () => {
  it.each([
    ["GET", "/api/sync/heartbeat"],
    ["GET", "/api/categories"],
    ["GET", "/api/categories/1/products"],
    ["GET", "/api/products/1/sizes"],
    ["GET", "/api/products/1/recipe"],
    ["GET", "/api/config/exchange-rate"],
    ["POST", "/api/auth/manager/login"],
    ["POST", "/api/auth/admin/login"],
    ["POST", "/api/auth/manager/pin/verify"],
  ])("lets %s %s through without a token", async (method, path) => {
    const res = await proxy(makeRequest(method, path));

    expect(res.status).not.toBe(401);
    expect(mockedVerifyManagerToken).not.toHaveBeenCalled();
  });

  it("PIN verify never touches session-token verification — its own PIN check is the whole gate", async () => {
    const res = await proxy(makeRequest("POST", "/api/auth/manager/pin/verify"));

    expect(res.status).not.toBe(401);
    expect(mockedVerifySessionToken).not.toHaveBeenCalled();
  });

  it.each([
    ["POST", "/api/categories"],
    ["PATCH", "/api/categories/1"],
    ["DELETE", "/api/categories/1"],
    ["POST", "/api/products"],
    ["PATCH", "/api/products/1"],
    ["DELETE", "/api/products/1"],
    ["POST", "/api/employees"],
    ["GET", "/api/employees"],
    ["GET", "/api/employees/1"],
    ["PATCH", "/api/employees/1"],
    ["DELETE", "/api/employees/1"],
    ["POST", "/api/managers"],
    ["GET", "/api/managers"],
    ["GET", "/api/managers/1"],
    ["GET", "/api/suppliers"],
    ["POST", "/api/suppliers"],
    ["PATCH", "/api/suppliers/1"],
    ["DELETE", "/api/suppliers/1"],
    ["POST", "/api/inventory-items"],
    ["GET", "/api/inventory-items"],
    ["GET", "/api/inventory-items/1/pack-configurations"],
    ["POST", "/api/inventory-count-entries"],
    ["GET", "/api/inventory-count-entries"],
    ["GET", "/api/inventory-count-entries/1"],
    ["POST", "/api/deliveries"],
    ["GET", "/api/deliveries"],
    ["GET", "/api/deliveries/1"],
    ["PUT", "/api/config/exchange-rate"],
    ["POST", "/api/products/1/recipe"],
    ["PATCH", "/api/products/1/recipe/10"],
    ["POST", "/api/sync/records"],
  ])("returns 401 for %s %s with no token", async (method, path) => {
    const res = await proxy(makeRequest(method, path));

    expect(res.status).toBe(401);
  });

  it("returns 401 when the token fails verification", async () => {
    mockedVerifyManagerToken.mockReturnValue(null);

    const res = await proxy(makeRequest("POST", "/api/products", "bad.token.here"));

    expect(res.status).toBe(401);
  });

  it("returns 401 when the manager behind a valid token was deactivated", async () => {
    mockedVerifyManagerToken.mockReturnValue({ manager_id: 1, exp: 9999999999 });
    mockIsActiveManager(false);

    const res = await proxy(makeRequest("POST", "/api/products", "valid.jwt.token"));

    expect(res.status).toBe(401);
  });

  it("lets the request through and forwards x-manager-id for a valid active manager", async () => {
    mockedVerifyManagerToken.mockReturnValue({ manager_id: 7, exp: 9999999999 });
    mockIsActiveManager(true);

    const res = await proxy(makeRequest("POST", "/api/products", "valid.jwt.token"));

    expect(res.status).not.toBe(401);
    expect(res.headers.get("x-middleware-request-x-manager-id")).toBe("7");
  });
});

describe("proxy admin routes", () => {
  const adminRoutes: Array<[string, string]> = [
    ["POST", "/api/managers"],
    ["PATCH", "/api/managers/1"],
    ["DELETE", "/api/managers/1"],
    ["POST", "/api/products/1/recipe"],
    ["PATCH", "/api/products/1/recipe/10"],
  ];

  it.each(adminRoutes)(
    "returns 401 for %s %s with no admin token, and never checks the manager token at all",
    async (method, path) => {
      const res = await proxy(makeAdminRequest(method, path));

      expect(res.status).toBe(401);
      expect(mockedVerifyManagerToken).not.toHaveBeenCalled();
    },
  );

  it.each(adminRoutes)("returns 401 for %s %s with an invalid admin token", async (method, path) => {
    mockedVerifyAdminToken.mockReturnValue(null);

    const res = await proxy(makeAdminRequest(method, path, "bad.admin.token"));

    expect(res.status).toBe(401);
  });

  it.each(adminRoutes)(
    "lets %s %s through with a valid admin token, never touching manager verification",
    async (method, path) => {
      mockedVerifyAdminToken.mockReturnValue({ role: "admin", exp: 9999999999 });

      const res = await proxy(makeAdminRequest(method, path, "valid.admin.token"));

      expect(res.status).not.toBe(401);
      expect(mockedVerifyManagerToken).not.toHaveBeenCalled();
    },
  );

  it("a manager token alone does not grant access to admin routes — auth is never combined", async () => {
    mockedVerifyManagerToken.mockReturnValue({ manager_id: 1, exp: 9999999999 });
    mockIsActiveManager(true);

    const res = await proxy(makeRequest("POST", "/api/managers", "valid.manager.token"));

    expect(res.status).toBe(401);
    expect(mockedVerifyManagerToken).not.toHaveBeenCalled();
  });
});

describe("proxy panel routes", () => {
  const panelRoutes: Array<[string, string]> = [
    ["POST", "/api/shift-sessions"],
    ["POST", "/api/shift-sessions/current/cash-out"],
  ];

  it.each(panelRoutes)("returns 401 for %s %s with no panel token", async (method, path) => {
    const res = await proxy(makePanelRequest(method, path));

    expect(res.status).toBe(401);
  });

  it.each(panelRoutes)("returns 401 for %s %s with an invalid panel token", async (method, path) => {
    mockedVerifyPanelSecret.mockReturnValue(false);

    const res = await proxy(makePanelRequest(method, path, "bad-panel-token"));

    expect(res.status).toBe(401);
  });

  it.each(panelRoutes)(
    "lets %s %s through with a valid panel token, never touching manager verification",
    async (method, path) => {
      mockedVerifyPanelSecret.mockReturnValue(true);

      const res = await proxy(makePanelRequest(method, path, "valid-panel-token"));

      expect(res.status).not.toBe(401);
      expect(mockedVerifyManagerToken).not.toHaveBeenCalled();
    },
  );

  it.each(panelRoutes)("a manager token alone does not grant access to %s %s", async (method, path) => {
    mockedVerifyManagerToken.mockReturnValue({ manager_id: 1, exp: 9999999999 });
    mockIsActiveManager(true);

    const res = await proxy(makeRequest(method, path, "valid.manager.token"));

    expect(res.status).toBe(401);
  });

  it("POST /api/shift-sessions/current/cash-out does not require a session token, unlike the by-id cash-out route", async () => {
    mockedVerifyPanelSecret.mockReturnValue(true);

    const res = await proxy(makePanelRequest("POST", "/api/shift-sessions/current/cash-out", "valid-panel-token"));

    expect(res.status).not.toBe(401);
    expect(mockedVerifySessionToken).not.toHaveBeenCalled();
  });
});

describe("proxy session+panel routes (cash-out)", () => {
  const path = "/api/shift-sessions/session-1/cash-out";

  it("returns 401 with no session token at all", async () => {
    const res = await proxy(makeSessionRequest("POST", path, undefined, "valid-panel-token"));

    expect(res.status).toBe(401);
  });

  it("returns 401 with a valid session but no panel token", async () => {
    mockedVerifySessionToken.mockReturnValue({ session_id: "session-1", exp: 9999999999 });
    mockIsOpenSession(true);

    const res = await proxy(makeSessionRequest("POST", path, "valid.session.token"));

    expect(res.status).toBe(401);
  });

  it("returns 401 with a valid panel token but a closed session", async () => {
    mockedVerifySessionToken.mockReturnValue({ session_id: "session-1", exp: 9999999999 });
    mockIsOpenSession(false);
    mockedVerifyPanelSecret.mockReturnValue(true);

    const res = await proxy(makeSessionRequest("POST", path, "valid.session.token", "valid-panel-token"));

    expect(res.status).toBe(401);
  });

  it("lets the request through and forwards x-session-id when both are valid", async () => {
    mockedVerifySessionToken.mockReturnValue({ session_id: "session-1", exp: 9999999999 });
    mockIsOpenSession(true);
    mockedVerifyPanelSecret.mockReturnValue(true);

    const res = await proxy(makeSessionRequest("POST", path, "valid.session.token", "valid-panel-token"));

    expect(res.status).not.toBe(401);
    expect(res.headers.get("x-middleware-request-x-session-id")).toBe("session-1");
  });
});
