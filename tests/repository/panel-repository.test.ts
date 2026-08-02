jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    appConfig: { findUnique: jest.fn() },
  },
}));

import prisma from "@/lib/db";
import { PanelRepository } from "@/repository/panel-repository";

const db = prisma as unknown as { appConfig: { findUnique: jest.Mock } };

describe("PanelRepository.getManagerPinHash", () => {
  const repo = new PanelRepository();

  it("returns the stored hash when configured", async () => {
    db.appConfig.findUnique.mockResolvedValue({ config_key: "manager_pin", config_value: "salt:hash" });

    await expect(repo.getManagerPinHash()).resolves.toBe("salt:hash");
    expect(db.appConfig.findUnique).toHaveBeenCalledWith({ where: { config_key: "manager_pin" } });
  });

  it("returns null when never configured", async () => {
    db.appConfig.findUnique.mockResolvedValue(null);

    await expect(repo.getManagerPinHash()).resolves.toBeNull();
  });
});
