import { z } from "zod";
import { t } from "@/lib/i18n/t";

/**
 * Shared login schema — imported by BOTH the client form and the API route
 * handler (trust boundary re-validation, Principle V). Backend platform login
 * resolves users by email; no `loginType` is ever sent from this dashboard.
 */
export const loginSchema = z.object({
  email: z.email(t("validation.email")).max(255, t("validation.maxLength", { max: 255 })),
  password: z.string().min(8, t("validation.passwordMin")).max(128, t("validation.maxLength", { max: 128 })),
  rememberMe: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;
/** Form values BEFORE defaults apply (zod v4: `rememberMe` is optional on input). */
export type LoginFormValues = z.input<typeof loginSchema>;
