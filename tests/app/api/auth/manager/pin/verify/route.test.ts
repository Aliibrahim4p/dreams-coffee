jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/panel-auth-service");

import { NextRequest } from "next/server";
import { PanelAuthService } from "@/services/panel-auth-service";
import UnauthorizedException from "@/exceptions/unauthorized-exception";
import { POST } from "@/app/api/auth/manager/pin/verify/route";

const MockedPanelAuthService = PanelAuthService as jest.Mocked<typeof PanelAuthService>;

function makeRequest(body: unknown, sessionToken: string | null = "session-token") {
  return new NextRequest("http://localhost/api/auth/manager/pin/verify", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...(sessionToken !== null ? { "x-session-token": sessionToken } : {}),
    },
  });
}

describe("POST /api/auth/manager/pin/verify", () => {
  it("returns 200 with the panel token on success", async () => {
    MockedPanelAuthService.verifyPin.mockResolvedValue({ panel_token: "the-panel-secret" });

    const res = await POST(makeRequest({ pin: "1234" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.panel_token).toBe("the-panel-secret");
  });

  it("returns 400 when pin is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(MockedPanelAuthService.verifyPin).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/auth/manager/pin/verify", {
      method: "POST",
      body: "not valid json",
      headers: { "content-type": "application/json", "x-session-token": "session-token" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(MockedPanelAuthService.verifyPin).not.toHaveBeenCalled();
  });

  it("returns 401 for an incorrect PIN", async () => {
    MockedPanelAuthService.verifyPin.mockRejectedValue(new UnauthorizedException("Incorrect PIN"));

    const res = await POST(makeRequest({ pin: "0000" }));

    expect(res.status).toBe(401);
  });

  it("returns 500 on an unexpected error", async () => {
    MockedPanelAuthService.verifyPin.mockRejectedValue(new Error("boom"));

    const res = await POST(makeRequest({ pin: "1234" }));

    expect(res.status).toBe(500);
  });
});
