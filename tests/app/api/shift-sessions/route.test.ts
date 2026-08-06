jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/shift-session-service");

import { NextRequest } from "next/server";
import { ShiftSessionService } from "@/services/shift-session-service";
import NotFoundException from "@/exceptions/not-found-exception";
import UniqueException from "@/exceptions/unique-exception";
import { POST } from "@/app/api/shift-sessions/route";

const MockedService = ShiftSessionService as jest.Mocked<typeof ShiftSessionService>;

function makeRequest(body: unknown, panelToken: string | null = "panel-token") {
  return new NextRequest("http://localhost/api/shift-sessions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...(panelToken !== null ? { "x-panel-token": panelToken } : {}),
    },
  });
}

const validBody = { cashier_pos_id: 1, starting_float: 50000 };

describe("POST /api/shift-sessions", () => {
  it("returns 201 with the opened session on success", async () => {
    MockedService.openSession.mockResolvedValue({
      session_id: "session-1",
      cashier_pos_id: 1,
      cashier_name: "John Doe",
      starting_float: 50000,
      start_time: new Date(),
      end_time: null,
      live_cash_total: 50000,
      session_token: "signed.session.token",
      trigger_drawer_pulse: true,
    });

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.session_token).toBe("signed.session.token");
    expect(json.trigger_drawer_pulse).toBe(true);
    expect(MockedService.openSession).toHaveBeenCalledWith(validBody);
  });

  it("returns 400 when starting_float is missing", async () => {
    const res = await POST(makeRequest({ cashier_pos_id: 1 }));
    expect(res.status).toBe(400);
    expect(MockedService.openSession).not.toHaveBeenCalled();
  });

  it("returns 400 when starting_float is 0", async () => {
    const res = await POST(makeRequest({ ...validBody, starting_float: 0 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when cashier_pos_id does not match an active employee", async () => {
    MockedService.openSession.mockRejectedValue(
      new NotFoundException("cashier_pos_id does not match any active employee"),
    );

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(404);
  });

  it("returns 409 when a session is already open", async () => {
    MockedService.openSession.mockRejectedValue(new UniqueException("A session is already open on this terminal"));

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(409);
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/shift-sessions", {
      method: "POST",
      body: "not valid json",
      headers: { "content-type": "application/json", "x-panel-token": "panel-token" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(MockedService.openSession).not.toHaveBeenCalled();
  });

  it("returns 500 on an unexpected error", async () => {
    MockedService.openSession.mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(500);
  });
});
