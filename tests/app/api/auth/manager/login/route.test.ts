jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/manager-auth-service");

import { NextRequest } from "next/server";
import { ManagerAuthService } from "@/services/manager-auth-service";
import UnauthorizedException from "@/exceptions/unauthorized-exception";
import { POST } from "@/app/api/auth/manager/login/route";

const MockedManagerAuthService = ManagerAuthService as jest.Mocked<typeof ManagerAuthService>;

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/manager/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/manager/login", () => {
  it("returns 200 with the manager token on success", async () => {
    MockedManagerAuthService.login.mockResolvedValue({
      manager_token: "signed.jwt.token",
      expires_at: new Date(),
      manager: { manager_id: 1, username: "jdoe", first_name: "Jane", last_name: "Doe" },
    });

    const res = await POST(makeRequest({ username: "jdoe", password: "Hunter2!" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.manager_token).toBe("signed.jwt.token");
  });

  it("returns 400 when username is missing", async () => {
    const res = await POST(makeRequest({ password: "Hunter2!" }));
    expect(res.status).toBe(400);
    expect(MockedManagerAuthService.login).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/auth/manager/login", {
      method: "POST",
      body: "not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(MockedManagerAuthService.login).not.toHaveBeenCalled();
  });

  it("returns 401 for incorrect credentials", async () => {
    MockedManagerAuthService.login.mockRejectedValue(
      new UnauthorizedException("Incorrect username or password"),
    );

    const res = await POST(makeRequest({ username: "jdoe", password: "WrongPass1!" }));

    expect(res.status).toBe(401);
  });

  it("returns 500 on an unexpected error", async () => {
    MockedManagerAuthService.login.mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest({ username: "jdoe", password: "Hunter2!" }));

    expect(res.status).toBe(500);
  });
});
