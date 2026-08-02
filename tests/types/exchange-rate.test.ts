import { ExchangeRateUpdateSchema } from "@/types/exchange-rate";

describe("ExchangeRateUpdateSchema", () => {
  it("accepts a positive rate_value", () => {
    expect(ExchangeRateUpdateSchema.safeParse({ rate_value: 89500 }).success).toBe(true);
  });

  it("rejects a zero rate_value", () => {
    expect(ExchangeRateUpdateSchema.safeParse({ rate_value: 0 }).success).toBe(false);
  });

  it("rejects a missing rate_value", () => {
    expect(ExchangeRateUpdateSchema.safeParse({}).success).toBe(false);
  });
});
