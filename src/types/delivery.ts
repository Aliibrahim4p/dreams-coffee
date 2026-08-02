import z from "zod";

export const DeliveryLineItemSchema = z.object({
  item_id: z.number().int(),
  config_id: z.number().int(),
  qty_received: z.number().positive(),
  /** Total price paid for this line's qty_received (e.g. 3 boxes) — cost_per_unit is derived from this, not entered directly. */
  total_cost: z.number().nonnegative(),
});
export type DeliveryLineItemInput = z.infer<typeof DeliveryLineItemSchema>;

export const DeliveryCreateSchema = z.object({
  supplier_id: z.number().int(),
  notes: z.string().nullable().optional(),
  line_items: z.array(DeliveryLineItemSchema).min(1),
});
export type DeliveryCreate = z.infer<typeof DeliveryCreateSchema>;
