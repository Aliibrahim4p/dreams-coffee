jest.mock("@/repository/panel-repository");
jest.mock("@/lib/password");
jest.mock("@/lib/panel-secret");

import { PanelRepository } from "@/repository/panel-repository";
import { verifyPassword } from "@/lib/password";
import { issuePanelToken } from "@/lib/panel-secret";
import UnauthorizedException from "@/exceptions/unauthorized-exception";
import { PanelAuthService } from "@/services/panel-auth-service";

const MockedPanelRepository = PanelRepository as jest.MockedClass<typeof PanelRepository>;
const mockedVerifyPassword = verifyPassword as jest.Mock;
const mockedIssuePanelToken = issuePanelToken as jest.Mock;

function mockRepo(overrides: Partial<Record<string, jest.Mock>>) {
  MockedPanelRepository.mockImplementation(() => overrides as unknown as PanelRepository);
}

describe("PanelAuthService.verifyPin", () => {
  it("returns the static panel token for the correct PIN", async () => {
    mockRepo({ getManagerPinHash: jest.fn().mockResolvedValue("salt:hash") });
    mockedVerifyPassword.mockResolvedValue(true);
    mockedIssuePanelToken.mockReturnValue("the-panel-secret");

    const result = await PanelAuthService.verifyPin({ pin: "1234" });

    expect(mockedVerifyPassword).toHaveBeenCalledWith("1234", "salt:hash");
    expect(result).toEqual({ panel_token: "the-panel-secret" });
  });

  it("throws UnauthorizedException when the PIN has never been configured", async () => {
    mockRepo({ getManagerPinHash: jest.fn().mockResolvedValue(null) });

    await expect(PanelAuthService.verifyPin({ pin: "1234" })).rejects.toThrow(UnauthorizedException);
    expect(mockedVerifyPassword).not.toHaveBeenCalled();
    expect(mockedIssuePanelToken).not.toHaveBeenCalled();
  });

  it("throws UnauthorizedException for an incorrect PIN", async () => {
    mockRepo({ getManagerPinHash: jest.fn().mockResolvedValue("salt:hash") });
    mockedVerifyPassword.mockResolvedValue(false);

    await expect(PanelAuthService.verifyPin({ pin: "0000" })).rejects.toThrow(UnauthorizedException);
    expect(mockedIssuePanelToken).not.toHaveBeenCalled();
  });
});
