import prisma from "@/lib/db";
import NotFoundException from "@/exceptions/not-found-exception";
import logger from "@/util/logger";

const EXCHANGE_RATE_KEY = "exchange_rate";

export class ExchangeRateRepository {
  async getExchangeRate() {
    const config = await prisma.appConfig.findUnique({ where: { config_key: EXCHANGE_RATE_KEY } });
    if (!config) {
      throw new NotFoundException("Exchange rate not configured");
    }
    return { rate_value: Number(config.config_value) };
  }

  async updateExchangeRate(rateValue: number) {
    try {
      const config = await prisma.appConfig.upsert({
        where: { config_key: EXCHANGE_RATE_KEY },
        create: { config_key: EXCHANGE_RATE_KEY, config_value: String(rateValue) },
        update: { config_value: String(rateValue) },
      });
      return { rate_value: Number(config.config_value) };
    } catch (error) {
      logger.error("Failed to update exchange rate to %d: %s", rateValue, error);
      throw error;
    }
  }
}
