jest.mock("@/repository/exchange-rate-repository");

import { ExchangeRateRepository } from "@/repository/exchange-rate-repository";
import { ExchangeRateService } from "@/services/exchange-rate-service";

const MockedRepo = ExchangeRateRepository as jest.MockedClass<typeof ExchangeRateRepository>;

function mockRepo(overrides: Partial<Record<string, jest.Mock>>) {
  MockedRepo.mockImplementation(() => overrides as unknown as ExchangeRateRepository);
}

describe("ExchangeRateService", () => {
  it("getExchangeRate delegates to the repository", async () => {
    const getExchangeRate = jest.fn().mockResolvedValue({ rate_value: 89500 });
    mockRepo({ getExchangeRate });

    await ExchangeRateService.getExchangeRate();

    expect(getExchangeRate).toHaveBeenCalled();
  });

  it("updateExchangeRate delegates to the repository", async () => {
    const updateExchangeRate = jest.fn().mockResolvedValue({ rate_value: 90000 });
    mockRepo({ updateExchangeRate });

    await ExchangeRateService.updateExchangeRate(90000);

    expect(updateExchangeRate).toHaveBeenCalledWith(90000);
  });
});
