jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/admin-auth-service");

import { NextRequest } from "next/server";
import { AdminAuthService } from "@/services/admin-auth-service";
import UnauthorizedException from "@/exceptions/unauthorized-exception";
import { POST } from "@/app/api/auth/admin/login/route";

const MockedAdminAuthService = AdminAuthService as jest.Mocked<typeof AdminAuthService>;

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/admin/login", () => {
  it("returns 200 with the admin token on success", async () => {
    MockedAdminAuthService.login.mockResolvedValue({
      admin_token: "signed.admin.token",
      expires_at: new Date(),
    });

    const res = await POST(makeRequest({ admin_key: "correct-key" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.admin_token).toBe("signed.admin.token");
  });

  it("returns 400 when admin_key is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(MockedAdminAuthService.login).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/auth/admin/login", {
      method: "POST",
      body: "not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(MockedAdminAuthService.login).not.toHaveBeenCalled();
  });

  it("returns 401 for an incorrect admin key", async () => {
    MockedAdminAuthService.login.mockRejectedValue(new UnauthorizedException("Incorrect admin key"));

    const res = await POST(makeRequest({ admin_key: "wrong-key" }));

    expect(res.status).toBe(401);
  });

  it("returns 500 on an unexpected error", async () => {
    MockedAdminAuthService.login.mockRejectedValue(new Error("boom"));

    const res = await POST(makeRequest({ admin_key: "correct-key" }));

    expect(res.status).toBe(500);
  });
});
