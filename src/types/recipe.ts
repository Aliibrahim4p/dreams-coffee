import z from "zod";

export const RecipeIngredientSchema = z.object({
  item_id: z.number().int(),
  /** exact amount to deduct; can be negative (schema note on recipe_ingredient.quantity) */
  quantity: z.number(),
  unit: z.enum(["g", "ml", "piece"]),
});

export const RecipeCreateSchema = z.object({
  modifier_id: z.number().int().nullable(),
  ingredients: z.array(RecipeIngredientSchema).min(1),
});
export type RecipeCreate = z.infer<typeof RecipeCreateSchema>;

export const RecipeUpdateSchema = z
  .object({
    modifier_id: z.number().int().nullable().optional(),
    /** replaces the full ingredient list — not merged with the existing set */
    ingredients: z.array(RecipeIngredientSchema).min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });
export type RecipeUpdate = z.infer<typeof RecipeUpdateSchema>;
