import z from "zod";

export const ExchangeRateUpdateSchema = z.object({
  rate_value: z.number().positive(),
});
export type ExchangeRateUpdate = z.infer<typeof ExchangeRateUpdateSchema>;
