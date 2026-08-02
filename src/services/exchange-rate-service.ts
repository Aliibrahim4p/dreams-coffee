import { ExchangeRateRepository } from "@/repository/exchange-rate-repository";

export class ExchangeRateService {
  static async getExchangeRate() {
    return new ExchangeRateRepository().getExchangeRate();
  }

  static async updateExchangeRate(rateValue: number) {
    return new ExchangeRateRepository().updateExchangeRate(rateValue);
  }
}
