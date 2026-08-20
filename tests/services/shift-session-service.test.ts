jest.mock("@/repository/shift-session-repository");
jest.mock("@/lib/session-jwt");

import { ShiftSessionRepository } from "@/repository/shift-session-repository";
import { signSessionToken } from "@/lib/session-jwt";
import { ShiftSessionService } from "@/services/shift-session-service";

const MockedRepo = ShiftSessionRepository as jest.MockedClass<typeof ShiftSessionRepository>;
const mockedSignSessionToken = signSessionToken as jest.Mock;

function mockRepo(overrides: Partial<Record<string, jest.Mock>>) {
  MockedRepo.mockImplementation(() => overrides as unknown as ShiftSessionRepository);
}

describe("ShiftSessionService.openSession", () => {
  it("opens the session and signs a session token for it", async () => {
    const openSession = jest.fn().mockResolvedValue({ session_id: "session-1", cashier_pos_id: 1 });
    mockRepo({ openSession });
    mockedSignSessionToken.mockReturnValue({ token: "signed.session.token" });
    const data = { cashier_pos_id: 1, starting_float: 50000 };

    const result = await ShiftSessionService.openSession(data);

    expect(openSession).toHaveBeenCalledWith(data);
    expect(mockedSignSessionToken).toHaveBeenCalledWith("session-1");
    expect(result).toEqual({
      session_id: "session-1",
      cashier_pos_id: 1,
      session_token: "signed.session.token",
      trigger_drawer_pulse: true,
    });
  });
});

describe("ShiftSessionService.cashOut", () => {
  it("delegates to the repository", async () => {
    const cashOut = jest.fn().mockResolvedValue({ session_id: "session-1", gross_sales: 0 });
    mockRepo({ cashOut });

    await ShiftSessionService.cashOut("session-1");

    expect(cashOut).toHaveBeenCalledWith("session-1");
  });
});

describe("ShiftSessionService.cashOutCurrent", () => {
  it("delegates to the repository", async () => {
    const cashOutCurrent = jest.fn().mockResolvedValue({ session_id: "session-1", gross_sales: 0 });
    mockRepo({ cashOutCurrent });

    await ShiftSessionService.cashOutCurrent();

    expect(cashOutCurrent).toHaveBeenCalled();
  });
});
