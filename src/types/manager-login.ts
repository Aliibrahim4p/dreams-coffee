import z from "zod";
import { hasUnsafeCharacters } from "@/lib/safe-text";

export const ManagerLoginSchema = z.object({
  username: z
    .string()
    .min(1)
    .max(100)
    .refine((value) => !hasUnsafeCharacters(value), "username contains disallowed characters"),
  // No character-set restriction here — password is scrypt-hashed and compared,
  // never interpolated into a query or rendered, so restricting its charset would
  // only shrink the entropy space without closing any real injection surface.
  password: z.string().min(1).max(200),
});
export type ManagerLogin = z.infer<typeof ManagerLoginSchema>;
