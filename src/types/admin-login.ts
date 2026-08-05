import z from "zod";
import { hasUnsafeCharacters } from "@/lib/safe-text";

export const AdminLoginSchema = z.object({
  admin_key: z
    .string()
    .min(1)
    .max(200)
    .refine((value) => !hasUnsafeCharacters(value), "admin_key contains disallowed characters"),
});
export type AdminLogin = z.infer<typeof AdminLoginSchema>;
