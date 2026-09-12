"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { loginSchema, type LoginFormValues, type LoginInput } from "@/lib/schemas/auth";
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
      setFormError("مشكلة في الاتصال بالسيرفر");
      return;
    }

    const payload = (await res.json().catch(() => null)) as (ApiError & {
      data?: { id: string; email: string | null; appRole: string };
    }) | null;

    if (!res.ok || !payload?.data) {
      const fields = payload?.details?.fields;
      if (fields) {
        for (const [key, messages] of Object.entries(fields)) {
          const msg = Array.isArray(messages) ? messages.join("، ") : messages;
          if (key === "email" || key === "password") {
            form.setError(key as "email" | "password", { message: msg });
          }
        }
      }
      setFormError(payload?.message ?? "بيانات الدخول غير صحيحة");
      return;
    }

    setSession(payload.data);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="page-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="title-grad text-2xl font-extrabold">تسجيل الدخول</h1>
        <p className="mt-1 text-sm text-[#606060]">لوحة تحكم المشرف العام — منصة الأتوبيسات</p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>البريد الإلكتروني</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      dir="ltr"
                      placeholder="admin@bus.local"
                      autoComplete="username"
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
                <FormItem>
                  <FormLabel>كلمة السر</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        dir="ltr"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "إخفاء كلمة السر" : "إظهار كلمة السر"}
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-[#606060] hover:text-[#1a1a1a]"
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
                <div className="flex items-center gap-2">
                  <input
                    id="rememberMe"
                    type="checkbox"
                    checked={field.value ?? false}
                    onChange={field.onChange}
                    className="h-4 w-4 accent-[#2f719e]"
                  />
                  <label htmlFor="rememberMe" className="text-sm text-[#1a1a1a]">
                    تذكرني
                  </label>
                </div>
              )}
            />

            {formError && (
              <p role="alert" className="text-sm text-red-600">
                {formError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "جاري الدخول…" : "دخول"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
