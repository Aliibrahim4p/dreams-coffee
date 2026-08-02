jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/shift-session-service");

import { ShiftSessionService } from "@/services/shift-session-service";
import NotFoundException from "@/exceptions/not-found-exception";
import { POST } from "@/app/api/shift-sessions/current/cash-out/route";

const MockedService = ShiftSessionService as jest.Mocked<typeof ShiftSessionService>;

describe("POST /api/shift-sessions/current/cash-out", () => {
  it("returns 200 with the closed session and gross_sales", async () => {
    MockedService.cashOutCurrent.mockResolvedValue({
      session_id: "session-1",
      cashier_pos_id: 1,
      cashier_name: "John Doe",
      starting_float: 50000,
      start_time: new Date(),
      end_time: new Date(),
      live_cash_total: 50000,
      gross_sales: 15000,
    });

    const res = await POST();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.gross_sales).toBe(15000);
    expect(MockedService.cashOutCurrent).toHaveBeenCalled();
  });

  it("returns 404 when no session is open", async () => {
    MockedService.cashOutCurrent.mockRejectedValue(new NotFoundException("No open session on this terminal"));

    const res = await POST();

    expect(res.status).toBe(404);
  });

  it("returns 500 on an unexpected error", async () => {
    MockedService.cashOutCurrent.mockRejectedValue(new Error("db down"));

    const res = await POST();

    expect(res.status).toBe(500);
  });
});
