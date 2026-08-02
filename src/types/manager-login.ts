import z from "zod";

export const ManagerLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type ManagerLogin = z.infer<typeof ManagerLoginSchema>;
