import z from "zod";

export const EmployeeCreateSchema = z.object({
  pos_id: z.number().int(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
});
export type EmployeeCreate = z.infer<typeof EmployeeCreateSchema>;

export const EmployeeUpdateSchema = z
  .object({
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });
export type EmployeeUpdate = z.infer<typeof EmployeeUpdateSchema>;
