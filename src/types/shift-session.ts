import z from "zod";

export const OpenShiftSessionSchema = z.object({
  cashier_pos_id: z.number().int(),
  starting_float: z.number().positive(),
});
export type OpenShiftSession = z.infer<typeof OpenShiftSessionSchema>;
