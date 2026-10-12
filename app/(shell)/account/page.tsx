"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { changePasswordFormSchema, type ChangePasswordFormValues } from "@/lib/schemas/auth";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/t";

type ApiReply = { message?: string; details?: { fields?: Record<string, string | string[]> } };

const FIELDS = [
  ["currentPassword", "current-password"],
  ["newPassword", "new-password"],
  ["confirmPassword", "new-password"],
] as const;

/** Signed-in password change for every dashboard account (any staff role). */
export default function AccountPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    mode: "onBlur",
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const labels: Record<(typeof FIELDS)[number][0], string> = {
    currentPassword: t("auth.account.currentPassword"),
    newPassword: t("auth.account.newPassword"),
    confirmPassword: t("auth.account.confirmPassword"),
  };

  async function onSubmit(values: ChangePasswordFormValues) {
    setFormError(null);
    let ok = false;
    let reply: ApiReply | null = null;
    try {
      const res = await fetch("/api/auth/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
      });
      ok = res.ok;
      reply = (await res.json().catch(() => null)) as ApiReply | null;
    } catch {
      reply = { message: t("common.error.network") };
    }
    if (!ok) {
      for (const [key, messages] of Object.entries(reply?.details?.fields ?? {})) {
        if (key === "currentPassword" || key === "newPassword") {
          form.setError(key, { message: Array.isArray(messages) ? messages.join(t("common.listSeparator")) : messages });
        }
      }
      setFormError(reply?.message ?? t("common.error.network"));
      return;
    }
    form.reset();
    toast.success(t("auth.account.success"));
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("auth.account.title")}</h1>
          <p className="page-description">{t("auth.account.description")}</p>
        </div>
      </div>
      <section className="panel-card max-w-xl p-5 sm:p-6">
        <h2 className="section-title mb-4">{t("auth.account.sectionTitle")}</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {FIELDS.map(([name, autoComplete]) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-sm font-bold text-[#334454]">{labels[name]}</FormLabel>
                    <FormControl>
                      <PasswordInput dir="rtl" autoComplete={autoComplete} {...field} />
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
            <Button type="submit" loading={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t("auth.account.submitting") : t("auth.account.submit")}
            </Button>
          </form>
        </Form>
      </section>
    </div>
  );
}
