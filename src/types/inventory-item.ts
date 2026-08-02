import z from "zod";

export const InventoryItemCreateSchema = z.object({
  name: z.string().min(1),
  unit: z.enum(["g", "ml", "piece"]),
  count_frequency: z.enum(["daily", "monthly"]),
});
export type InventoryItemCreate = z.infer<typeof InventoryItemCreateSchema>;
