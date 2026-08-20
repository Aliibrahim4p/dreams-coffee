import z from "zod";

export const AdminLoginSchema = z.object({
  admin_key: z.string().min(1),
});
export type AdminLogin = z.infer<typeof AdminLoginSchema>;
