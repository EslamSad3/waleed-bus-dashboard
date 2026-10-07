"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { loginSchema, type LoginFormValues } from "@/lib/schemas/auth";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/stores/session";
import { t } from "@/lib/i18n/t";

type ApiError = {
  code?: string;
  message?: string;
  details?: { fields?: Record<string, string | string[]> };
};

export default function LoginPage() {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    let res: Response;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
    } catch {
      setFormError(t("common.error.network"));
      return;
    }

    const payload = (await res.json().catch(() => null)) as (ApiError & {
      data?: { id: string; email: string | null; appRole: string };
    }) | null;

    if (!res.ok || !payload?.data) {
      const fields = payload?.details?.fields;
      if (fields) {
        for (const [key, messages] of Object.entries(fields)) {
          const msg = Array.isArray(messages) ? messages.join(t("common.listSeparator")) : messages;
          if (key === "email" || key === "password") {
            form.setError(key as "email" | "password", { message: msg });
          }
        }
      }
      setFormError(payload?.message ?? t("auth.login.invalidCredentials"));
      return;
    }

    setSession(payload.data);
    router.push("/");
    router.refresh();
  }

  return (
    <main className="page-bg relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div aria-hidden="true" className="absolute -end-20 -top-24 h-72 w-72 rounded-full bg-[#d6eeff]/70 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-28 -start-20 h-80 w-80 rounded-full bg-[#fff7e3]/90 blur-3xl" />

      <section className="panel-card relative grid w-full max-w-5xl overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
        <div className="navy-band hidden min-h-[620px] flex-col justify-between p-10 text-white lg:flex">
          <div>
            <div className="inline-flex items-center rounded-2xl bg-white px-4 py-3 shadow-lg shadow-black/25">
              <Image
                src="/logo.png"
                alt={t("auth.login.logoAlt")}
                width={220}
                height={88}
                className="h-16 w-auto object-contain"
                priority
              />
            </div>
            <p className="mt-10 text-sm font-bold tracking-wide text-[#9ed5f8]">{t("auth.login.platformName")}</p>
            <h2 className="mt-3 max-w-sm text-4xl font-extrabold leading-[1.35]">
              {t("auth.login.tagline")}
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/70">
              {t("auth.login.subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-sm text-white/75">
            <ShieldCheck className="h-5 w-5 shrink-0 text-[#9ed5f8]" aria-hidden="true" />
            {t("auth.login.secureNote")}
          </div>
        </div>

        <div className="flex min-h-[560px] items-center p-6 sm:p-10 lg:p-12">
          <div className="w-full">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <span className="flex h-12 items-center overflow-hidden rounded-2xl bg-white px-2 shadow-lg shadow-[#00134c]/20 ring-1 ring-[#dce6ee]">
                <Image
                  src="/logo.png"
                  alt={t("auth.login.logoAlt")}
                  width={132}
                  height={48}
                  className="h-10 w-auto object-contain"
                  priority
                />
              </span>
              <div className="min-w-0">
                <p className="font-extrabold text-[#00134c]">{t("auth.login.brand")}</p>
                <p className="text-xs text-[#5e6b78]">{t("auth.login.panelTitle")}</p>
              </div>
            </div>

            <h1 className="title-grad text-3xl font-extrabold sm:text-4xl">{t("auth.login.welcome")}</h1>
            <p className="mt-2 text-sm leading-7 text-[#5e6b78]">{t("auth.login.welcomeHint")}</p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-2.5">
                  <FormLabel className="text-sm font-bold text-[#334454]">{t("common.fields.email")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      dir="rtl"
                      placeholder="admin@waleed-express.local"
                      autoComplete="username"
                      className="h-12 rounded-2xl px-4 text-right text-base"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-2.5">
                  <FormLabel className="text-sm font-bold text-[#334454]">{t("common.fields.password")}</FormLabel>
                  <FormControl>
                    <div className="relative" dir="rtl">
                      <Input
                        type={showPassword ? "text" : "password"}
                        dir="rtl"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="h-12 rounded-2xl px-4 pe-12 text-right text-base"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
                        className="absolute end-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#667786] transition hover:bg-[#eaf6ff] hover:text-[#00134c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059ff8]/30"
                      >
                        {showPassword ? (
                          <EyeOff aria-hidden="true" />
                        ) : (
                          <Eye aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <div className="rounded-2xl border border-[#dce6ee] bg-[#f8fbfd] px-4 py-3">
                  <input
                    id="rememberMe"
                    type="checkbox"
                    checked={field.value ?? false}
                    onChange={field.onChange}
                    className="peer sr-only"
                  />
                  <label htmlFor="rememberMe" className="flex cursor-pointer items-start gap-3 rounded-xl peer-focus-visible:ring-4 peer-focus-visible:ring-[#059ff8]/15">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${field.value ? "border-[#059ff8] bg-[#059ff8] text-white" : "border-[#9babb8] bg-white text-transparent"}`}>
                      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-[#243442]">{t("auth.login.rememberMe")}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-[#6f7e8b]">{t("auth.login.rememberMeHint")}</span>
                    </span>
                  </label>
                </div>
              )}
            />

            {formError && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
                {formError}
              </p>
            )}

            <Button type="submit" className="mt-2 w-full" size="lg" loading={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t("auth.login.submitting") : t("auth.login.submit")}
            </Button>
              </form>
            </Form>

            <p className="mt-8 text-center text-xs leading-6 text-[#8b98a5]">
              {t("auth.login.authorizedOnly")}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
