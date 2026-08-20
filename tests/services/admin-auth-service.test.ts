jest.mock("@/lib/verify-admin-secret");
jest.mock("@/lib/admin-jwt");

import { verifyAdminSecret } from "@/lib/verify-admin-secret";
import { signAdminToken } from "@/lib/admin-jwt";
import UnauthorizedException from "@/exceptions/unauthorized-exception";
import { AdminAuthService } from "@/services/admin-auth-service";

const mockedVerifyAdminSecret = verifyAdminSecret as jest.Mock;
const mockedSignAdminToken = signAdminToken as jest.Mock;

describe("AdminAuthService.login", () => {
  it("returns a signed admin token for the correct admin key", async () => {
    mockedVerifyAdminSecret.mockReturnValue(true);
    mockedSignAdminToken.mockReturnValue({
      token: "signed.admin.token",
      expiresAt: new Date("2026-08-01T08:00:00Z"),
    });

    const result = await AdminAuthService.login({ admin_key: "correct-key" });

    expect(mockedVerifyAdminSecret).toHaveBeenCalledWith("correct-key");
    expect(mockedSignAdminToken).toHaveBeenCalledWith(8 * 60 * 60);
    expect(result).toEqual({
      admin_token: "signed.admin.token",
      expires_at: new Date("2026-08-01T08:00:00Z"),
    });
  });

  it("throws UnauthorizedException for an incorrect admin key", async () => {
    mockedVerifyAdminSecret.mockReturnValue(false);

    await expect(AdminAuthService.login({ admin_key: "wrong-key" })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockedSignAdminToken).not.toHaveBeenCalled();
  });
});
