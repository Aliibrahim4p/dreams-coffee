import z from "zod";

export const InventoryCountEntryCreateSchema = z.object({
  item_id: z.number().int(),
  physical_count: z.number().nonnegative(),
});
export type InventoryCountEntryCreate = z.infer<typeof InventoryCountEntryCreateSchema>;

export const InventoryCountEntryUpdateSchema = z.object({
  physical_count: z.number().nonnegative(),
});
export type InventoryCountEntryUpdate = z.infer<typeof InventoryCountEntryUpdateSchema>;
