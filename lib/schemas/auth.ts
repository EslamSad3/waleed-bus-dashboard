import { z } from "zod";

/**
 * Shared login schema — imported by BOTH the client form and the API route
 * handler (trust boundary re-validation, Principle V). Backend platform login
 * resolves users by email; no `loginType` is ever sent from this dashboard.
 */
export const loginSchema = z.object({
  email: z.email("اكتب بريد إلكتروني صحيح"),
  password: z.string().min(8, "كلمة السر لازم تبقى 8 حروف على الأقل"),
  rememberMe: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;
/** Form values BEFORE defaults apply (zod v4: `rememberMe` is optional on input). */
export type LoginFormValues = z.input<typeof loginSchema>;
