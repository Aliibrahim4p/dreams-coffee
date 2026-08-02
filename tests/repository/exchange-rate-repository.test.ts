jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    appConfig: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}));

import prisma from "@/lib/db";
import NotFoundException from "@/exceptions/not-found-exception";
import { ExchangeRateRepository } from "@/repository/exchange-rate-repository";

const db = prisma as unknown as {
  appConfig: { findUnique: jest.Mock; upsert: jest.Mock };
};

describe("ExchangeRateRepository.getExchangeRate", () => {
  const repo = new ExchangeRateRepository();

  it("throws NotFoundException when no rate is configured", async () => {
    db.appConfig.findUnique.mockResolvedValue(null);
    await expect(repo.getExchangeRate()).rejects.toThrow(NotFoundException);
  });

  it("parses the stored string value to a number", async () => {
    db.appConfig.findUnique.mockResolvedValue({ config_key: "exchange_rate", config_value: "89500" });
    await expect(repo.getExchangeRate()).resolves.toEqual({ rate_value: 89500 });
  });
});

describe("ExchangeRateRepository.updateExchangeRate", () => {
  const repo = new ExchangeRateRepository();

  it("upserts the rate as a string and returns it parsed", async () => {
    db.appConfig.upsert.mockResolvedValue({ config_key: "exchange_rate", config_value: "90000" });

    const result = await repo.updateExchangeRate(90000);

    expect(db.appConfig.upsert).toHaveBeenCalledWith({
      where: { config_key: "exchange_rate" },
      create: { config_key: "exchange_rate", config_value: "90000" },
      update: { config_value: "90000" },
    });
    expect(result).toEqual({ rate_value: 90000 });
  });
});
