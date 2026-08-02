jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/shift-session-service");

import { NextRequest } from "next/server";
import { ShiftSessionService } from "@/services/shift-session-service";
import UniqueException from "@/exceptions/unique-exception";
import { POST } from "@/app/api/shift-sessions/[session_id]/cash-out/route";

const MockedService = ShiftSessionService as jest.Mocked<typeof ShiftSessionService>;

function makeRequest(sessionId: string | null = "session-1") {
  return new NextRequest("http://localhost/api/shift-sessions/session-1/cash-out", {
    method: "POST",
    headers: sessionId !== null ? { "x-session-id": sessionId } : {},
  });
}

function makeParams(session_id: string) {
  return { params: Promise.resolve({ session_id }) };
}

describe("POST /api/shift-sessions/[session_id]/cash-out", () => {
  it("returns 200 with the closed session and gross_sales", async () => {
    MockedService.cashOut.mockResolvedValue({
      session_id: "session-1",
      cashier_pos_id: 1,
      cashier_name: "John Doe",
      starting_float: 50000,
      start_time: new Date(),
      end_time: new Date(),
      live_cash_total: 50000,
      gross_sales: 42000,
    });

    const res = await POST(makeRequest(), makeParams("session-1"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.gross_sales).toBe(42000);
    expect(MockedService.cashOut).toHaveBeenCalledWith("session-1");
  });

  it("returns 401 when the x-session-id header is missing (proxy bypassed)", async () => {
    const res = await POST(makeRequest(null), makeParams("session-1"));

    expect(res.status).toBe(401);
    expect(MockedService.cashOut).not.toHaveBeenCalled();
  });

  it("returns 401 when the session token's session_id does not match the path", async () => {
    const res = await POST(makeRequest("session-2"), makeParams("session-1"));

    expect(res.status).toBe(401);
    expect(MockedService.cashOut).not.toHaveBeenCalled();
  });

  it("returns 409 when the session is already closed or an order is still open", async () => {
    MockedService.cashOut.mockRejectedValue(new UniqueException("Session already closed"));

    const res = await POST(makeRequest(), makeParams("session-1"));

    expect(res.status).toBe(409);
  });

  it("returns 500 on an unexpected error", async () => {
    MockedService.cashOut.mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest(), makeParams("session-1"));

    expect(res.status).toBe(500);
  });
});
