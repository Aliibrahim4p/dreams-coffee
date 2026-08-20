jest.mock("@/repository/manager-repository");
jest.mock("@/lib/password");
jest.mock("@/lib/jwt");

import { ManagerRepository } from "@/repository/manager-repository";
import { verifyPassword } from "@/lib/password";
import { signManagerToken } from "@/lib/jwt";
import UnauthorizedException from "@/exceptions/unauthorized-exception";
import { ManagerAuthService } from "@/services/manager-auth-service";

const MockedManagerRepository = ManagerRepository as jest.MockedClass<typeof ManagerRepository>;
const mockedVerifyPassword = verifyPassword as jest.Mock;
const mockedSignManagerToken = signManagerToken as jest.Mock;

const managerRow = {
  manager_id: 1,
  username: "jdoe",
  password_hash: "hashed",
  first_name: "Jane",
  last_name: "Doe",
  is_active: true,
  created_at: new Date(),
};

function mockFindByUsername(result: unknown) {
  const findByUsername = jest.fn().mockResolvedValue(result);
  MockedManagerRepository.mockImplementation(
    () => ({ findByUsername }) as unknown as ManagerRepository,
  );
  return findByUsername;
}

describe("ManagerAuthService.login", () => {
  it("returns a signed token and manager info for correct credentials", async () => {
    mockFindByUsername(managerRow);
    mockedVerifyPassword.mockResolvedValue(true);
    mockedSignManagerToken.mockReturnValue({ token: "signed.jwt.token", expiresAt: new Date("2026-08-01T08:00:00Z") });

    const result = await ManagerAuthService.login({ username: "jdoe", password: "Hunter2!" });

    expect(mockedSignManagerToken).toHaveBeenCalledWith(1, 8 * 60 * 60);
    expect(result).toEqual({
      manager_token: "signed.jwt.token",
      expires_at: new Date("2026-08-01T08:00:00Z"),
      manager: { manager_id: 1, username: "jdoe", first_name: "Jane", last_name: "Doe" },
    });
  });

  it("throws UnauthorizedException when the username does not exist", async () => {
    mockFindByUsername(null);

    await expect(
      ManagerAuthService.login({ username: "nobody", password: "Hunter2!" }),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockedVerifyPassword).not.toHaveBeenCalled();
  });

  it("throws UnauthorizedException when the manager is deactivated", async () => {
    mockFindByUsername({ ...managerRow, is_active: false });

    await expect(
      ManagerAuthService.login({ username: "jdoe", password: "Hunter2!" }),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockedVerifyPassword).not.toHaveBeenCalled();
  });

  it("throws UnauthorizedException when the password is incorrect", async () => {
    mockFindByUsername(managerRow);
    mockedVerifyPassword.mockResolvedValue(false);

    await expect(
      ManagerAuthService.login({ username: "jdoe", password: "WrongPass1!" }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
