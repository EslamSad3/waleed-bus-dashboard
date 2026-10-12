"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, KeyRound } from "lucide-react";
import { toast } from "sonner";
import {
  forgotEmailSchema,
  forgotPhoneSchema,
  resetPasswordFormSchema,
  type ResetPasswordFormValues,
} from "@/lib/schemas/auth";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/t";

type ApiReply = {
  code?: string;
  message?: string;
  retryAfter?: number;
  details?: { fields?: Record<string, string | string[]> };
};

/** The API's resend cooldown (email and SMS). */
const RESEND_SECONDS = 60;

type Method = "email" | "sms";

/** Per method: which proxy routes to call and how the target and code are named. */
const ROUTES: Record<Method, { forgot: string; reset: string; target: string; code: string }> = {
  email: { forgot: "/api/auth/password/forgot", reset: "/api/auth/password/reset", target: "email", code: "code" },
  sms: { forgot: "/api/auth/password/forgot-sms", reset: "/api/auth/password/reset-sms", target: "phoneNumber", code: "otp" },
};

async function post(path: string, body: unknown): Promise<{ ok: boolean; reply: ApiReply | null }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, reply: (await res.json().catch(() => null)) as ApiReply | null };
  } catch {
    return { ok: false, reply: { message: t("common.error.network") } };
  }
}

/**
 * Forgot password (signed out), by email or SMS. Step 1 sends a 6-digit code;
 * step 2 sends the code with the new password in ONE call (the API verifies
 * and resets together; there is no separate verify step). The first answer is
 * the same whether or not the account exists.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("email");
  const [target, setTarget] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const emailForm = useForm<{ email: string }>({
    resolver: zodResolver(forgotEmailSchema),
    mode: "onBlur",
    defaultValues: { email: "" },
  });
  const phoneForm = useForm<{ phoneNumber: string }>({
    resolver: zodResolver(forgotPhoneSchema),
    mode: "onBlur",
    defaultValues: { phoneNumber: "" },
  });
  const resetForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    mode: "onBlur",
    defaultValues: { code: "", newPassword: "", confirmPassword: "" },
  });

  async function requestCode(value: string) {
    setFormError(null);
    const route = ROUTES[method];
    const { ok, reply } = await post(route.forgot, { [route.target]: value });
    if (!ok) {
      setFormError(reply?.message ?? t("common.error.network"));
      if (reply?.retryAfter) setCooldown(reply.retryAfter);
      return;
    }
    setTarget(value);
    setCooldown(RESEND_SECONDS);
  }

  async function submitReset(values: ResetPasswordFormValues) {
    if (target === null) return;
    setFormError(null);
    const route = ROUTES[method];
    const { ok, reply } = await post(route.reset, {
      [route.target]: target,
      [route.code]: values.code,
      newPassword: values.newPassword,
    });
    if (!ok) {
      for (const [key, messages] of Object.entries(reply?.details?.fields ?? {})) {
        const field = key === route.code ? "code" : key === "newPassword" ? "newPassword" : null;
        if (field) {
          resetForm.setError(field, { message: Array.isArray(messages) ? messages.join(t("common.listSeparator")) : messages });
        }
      }
      setFormError(reply?.message ?? t("common.error.network"));
      return;
    }
    toast.success(t("auth.forgot.success"));
    router.push("/login");
  }

  const inputClass = "h-12 rounded-2xl px-4 text-right text-base";

  return (
    <main className="page-bg relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div aria-hidden="true" className="absolute -end-20 -top-24 h-72 w-72 rounded-full bg-[#d6eeff]/70 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-28 -start-20 h-80 w-80 rounded-full bg-[#fff7e3]/90 blur-3xl" />

      <section className="panel-card relative w-full max-w-lg p-6 sm:p-10">
        <span className="mb-6 grid size-12 place-items-center rounded-2xl bg-[#eaf6ff] text-[#059ff8]">
          <KeyRound className="size-6" aria-hidden="true" />
        </span>
        <h1 className="title-grad text-3xl font-extrabold">{t("auth.forgot.title")}</h1>
        <p className="mt-2 text-sm leading-7 text-[#5e6b78]">
          {target === null
            ? method === "email" ? t("auth.forgot.hint") : t("auth.forgot.hintSms")
            : method === "email" ? t("auth.forgot.codeSent", { email: target }) : t("auth.forgot.codeSentSms", { phone: target })}
        </p>

        {target === null ? (
          <div role="radiogroup" aria-label={t("auth.forgot.methodAria")} className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-[#f1f6fa] p-1">
            {([
              ["email", t("auth.forgot.byEmail")],
              ["sms", t("auth.forgot.bySms")],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={method === value}
                onClick={() => {
                  setMethod(value);
                  setFormError(null);
                }}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-bold transition",
                  method === value ? "bg-white text-[#00134c] shadow-sm" : "text-[#5e6b78] hover:text-[#00134c]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {target === null && method === "sms" ? (
          <Form {...phoneForm}>
            <form
              onSubmit={phoneForm.handleSubmit((values) => requestCode(values.phoneNumber))}
              className="mt-6 space-y-5"
              noValidate
            >
              <FormField
                control={phoneForm.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem className="space-y-2.5">
                    <FormLabel className="text-sm font-bold text-[#334454]">{t("auth.forgot.phone")}</FormLabel>
                    <FormControl>
                      <Input type="tel" dir="ltr" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" className="h-12 rounded-2xl px-4 text-left text-base" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {formError && (
                <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
                  {formError}
                </p>
              )}
              <Button type="submit" className="w-full" size="lg" loading={phoneForm.formState.isSubmitting}>
                {phoneForm.formState.isSubmitting ? t("auth.forgot.sending") : t("auth.forgot.send")}
              </Button>
            </form>
          </Form>
        ) : target === null ? (
          <Form {...emailForm}>
            <form
              onSubmit={emailForm.handleSubmit((values) => requestCode(values.email))}
              className="mt-6 space-y-5"
              noValidate
            >
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-2.5">
                    <FormLabel className="text-sm font-bold text-[#334454]">{t("common.fields.email")}</FormLabel>
                    <FormControl>
                      <Input type="email" dir="rtl" autoComplete="username" className={inputClass} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {formError && (
                <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
                  {formError}
                </p>
              )}
              <Button type="submit" className="w-full" size="lg" loading={emailForm.formState.isSubmitting}>
                {emailForm.formState.isSubmitting ? t("auth.forgot.sending") : t("auth.forgot.send")}
              </Button>
            </form>
          </Form>
        ) : (
          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(submitReset)} className="mt-8 space-y-5" noValidate>
              <FormField
                control={resetForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem className="space-y-2.5">
                    <FormLabel className="text-sm font-bold text-[#334454]">{t("auth.forgot.code")}</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        dir="ltr"
                        className="h-12 rounded-2xl px-4 text-center text-lg tracking-[0.4em]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {([
                ["newPassword", t("auth.forgot.newPassword")],
                ["confirmPassword", t("auth.forgot.confirmPassword")],
              ] as const).map(([name, label]) => (
                <FormField
                  key={name}
                  control={resetForm.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem className="space-y-2.5">
                      <FormLabel className="text-sm font-bold text-[#334454]">{label}</FormLabel>
                      <FormControl>
                        <PasswordInput dir="rtl" autoComplete="new-password" className={inputClass} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              {formError && (
                <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
                  {formError}
                </p>
              )}
              <Button type="submit" className="w-full" size="lg" loading={resetForm.formState.isSubmitting}>
                {resetForm.formState.isSubmitting ? t("auth.forgot.submitting") : t("auth.forgot.submit")}
              </Button>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <button
                  type="button"
                  disabled={cooldown > 0}
                  onClick={() => requestCode(target)}
                  className="font-bold text-[#059ff8] hover:underline disabled:cursor-not-allowed disabled:text-[#8b98a5] disabled:no-underline"
                >
                  {cooldown > 0 ? t("auth.forgot.resendIn", { seconds: String(cooldown) }) : t("auth.forgot.resend")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTarget(null);
                    setFormError(null);
                    resetForm.reset();
                  }}
                  className="font-bold text-[#5e6b78] hover:underline"
                >
                  {t("auth.forgot.changeEmail")}
                </button>
              </div>
            </form>
          </Form>
        )}

        <Link href="/login" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#059ff8]">
          <ArrowRight className="size-4" aria-hidden="true" />
          {t("auth.forgot.backToLogin")}
        </Link>
      </section>
    </main>
  );
}
