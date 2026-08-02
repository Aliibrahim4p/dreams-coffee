import z from "zod";

export const SupplierCreateSchema = z.object({
  name: z.string().min(1),
});
export type SupplierCreate = z.infer<typeof SupplierCreateSchema>;

export const SupplierUpdateSchema = z.object({
  name: z.string().min(1),
});
export type SupplierUpdate = z.infer<typeof SupplierUpdateSchema>;
