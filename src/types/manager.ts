import z from "zod";

const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a symbol";

export const PasswordSchema = z
  .string()
  .min(8, PASSWORD_POLICY_MESSAGE)
  .regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+/, PASSWORD_POLICY_MESSAGE);

export const ManagerCreateSchema = z.object({
  username: z.string().min(1),
  password: PasswordSchema,
  first_name: z.string().min(1),
  last_name: z.string().min(1),
});
export type ManagerCreate = z.infer<typeof ManagerCreateSchema>;

export const ManagerUpdateSchema = z
  .object({
    username: z.string().min(1).optional(),
    password: PasswordSchema.optional(),
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });
export type ManagerUpdate = z.infer<typeof ManagerUpdateSchema>;
