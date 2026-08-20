import z from "zod";

export const PanelPinVerifySchema = z.object({
  // Digits-only: a PIN has no legitimate use for HTML/SQL metacharacters, so this
  // is a stricter allow-list than the injection-pattern rejection used elsewhere (NFR-008).
  pin: z.string().min(1).max(12).regex(/^\d+$/, "pin must contain digits only"),
});
export type PanelPinVerify = z.infer<typeof PanelPinVerifySchema>;
