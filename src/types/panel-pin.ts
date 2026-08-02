import z from "zod";

export const PanelPinVerifySchema = z.object({
  pin: z.string().min(1),
});
export type PanelPinVerify = z.infer<typeof PanelPinVerifySchema>;
