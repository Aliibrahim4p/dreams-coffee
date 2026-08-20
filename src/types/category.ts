import z from "zod";

export const CategoryValidationSchema = z.object({
  name: z.string().min(1).max(40),
});
export type Category = z.infer<typeof CategoryValidationSchema>;

export const CategoryUpdateSchema = z.object({
  name: z.string().min(1).max(40),
});
export type CategoryUpdate = z.infer<typeof CategoryUpdateSchema>;
