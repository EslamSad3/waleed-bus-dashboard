import { z } from "zod";
import { t } from "@/lib/i18n/t";

/**
 * Shared login schema — imported by BOTH the client form and the API route
 * handler (trust boundary re-validation, Principle V). One field takes an email
 * OR a phone number; the API's credentials-only login derives JWT app_role.
 */
/** Same phone forms the API accepts (01…, +201…, 00201…); the API normalizes. */
const EGYPT_PHONE = /^(?:\+20|0020|0)?1\d{9}$/;

/** "a@b.c" → email login; anything else must be an Egyptian mobile → phone login. */
export function loginCredentials(identifier: string): { email: string } | { phone: string } {
  const value = identifier.trim();
  return value.includes("@") ? { email: value.toLowerCase() } : { phone: value.replace(/[\s-]/g, "") };
}

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, t("validation.required"))
    .max(255, t("validation.maxLength", { max: 255 }))
    .refine(
      (value) =>
        value.includes("@") ? z.email().safeParse(value).success : EGYPT_PHONE.test(value.replace(/[\s-]/g, "")),
      t("validation.loginIdentifier"),
    ),
  password: z.string().min(8, t("validation.passwordMin")).max(128, t("validation.maxLength", { max: 128 })),
  rememberMe: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;
/** Form values BEFORE defaults apply (zod v4: `rememberMe` is optional on input). */
export type LoginFormValues = z.input<typeof loginSchema>;

const newPassword = z
  .string()
  .min(8, t("validation.passwordMin"))
  .max(128, t("validation.maxLength", { max: 128 }));
const code = z.string().regex(/^\d{6}$/, t("validation.code6"));
const email = z.email(t("validation.email")).max(255, t("validation.maxLength", { max: 255 }));
/** Same forms the API accepts (01…, +201…, 00201…); the API normalizes. */
const phoneNumber = z.string().trim().regex(/^(?:\+20|0020|0)?1\d{9}$/, t("validation.phone"));
const matches = (values: { newPassword: string; confirmPassword: string }) =>
  values.confirmPassword === values.newPassword;
const mismatch = { path: ["confirmPassword"], message: t("validation.passwordMismatch") };

/** Forgot password by email — forwarded to /auth/password/forgot-email. */
export const forgotEmailSchema = z.object({ email });
/** Forgot password by SMS — forwarded to /auth/password/forgot. */
export const forgotPhoneSchema = z.object({ phoneNumber });

/** Reset by email (verifies the code and resets in ONE call) — /auth/password/reset-email. */
export const resetEmailSchema = z.object({ email, code, newPassword });
/** Reset by SMS (verifies the OTP and resets in ONE call) — /auth/password/reset. */
export const resetPhoneSchema = z.object({ phoneNumber, otp: code, newPassword });

/** Step-2 form (the target is held by the page; the confirmation never leaves the browser). */
export const resetPasswordFormSchema = z
  .object({ code, newPassword, confirmPassword: z.string() })
  .refine(matches, mismatch);
export type ResetPasswordFormValues = z.input<typeof resetPasswordFormSchema>;

/** Signed-in change — forwarded to /auth/password/change. */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, t("validation.required")).max(128, t("validation.maxLength", { max: 128 })),
  newPassword,
});
export const changePasswordFormSchema = changePasswordSchema
  .extend({ confirmPassword: z.string() })
  .refine(matches, mismatch);
export type ChangePasswordFormValues = z.input<typeof changePasswordFormSchema>;
