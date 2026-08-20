import z from "zod";

export const ProductCreateSchema = z.object({
  category_id: z.number().int(),
  name: z.string().min(1),
  type: z.enum(["recipe_based", "reseller"]),
  base_price: z.number().nonnegative(),
});
export type ProductCreate = z.infer<typeof ProductCreateSchema>;

export const ProductUpdateSchema = z
  .object({
    category_id: z.number().int().optional(),
    name: z.string().min(1).optional(),
    base_price: z.number().nonnegative().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>;
