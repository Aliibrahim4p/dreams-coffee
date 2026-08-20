import { ExchangeRateRepository } from "@/repository/exchange-rate-repository";
import logger from "@/util/logger";

export class ExchangeRateService {
  static async getExchangeRate() {
    return new ExchangeRateRepository().getExchangeRate();
  }

  static async updateExchangeRate(rateValue: number) {
    const rate = await new ExchangeRateRepository().updateExchangeRate(rateValue);
    logger.info("Exchange rate updated: %d", rateValue);
    return rate;
  }
}
