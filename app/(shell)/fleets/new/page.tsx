"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createFleetSchema } from "@/lib/schemas/p1";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createFleet, fetchUserOptions } from "@/lib/actions/fleets";

type Values = z.input<typeof createFleetSchema>;
type Owner = { id: string; name?: string | null; email?: string | null; phone?: string | null };

export default function NewFleetPage() {
  const router = useRouter();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(createFleetSchema),
    defaultValues: { name: "", ownerId: "", ownerRoleSlug: "" },
  });

  useEffect(() => {
    fetchUserOptions().then((r) => {
      if (r.ok) setOwners(r.data.items);
    });
  }, []);

  async function onSubmit(values: Values) {
    setFormError(null);
    setSaved(null);
    const payload = { ...values, ownerRoleSlug: values.ownerRoleSlug || undefined };
    const r = await createFleet(payload);
    if (!r.ok) {
      if (r.fields) {
        for (const [key, msg] of Object.entries(r.fields)) {
          if (key === "name" || key === "ownerId" || key === "ownerRoleSlug") {
            form.setError(key, { message: msg });
          }
        }
      }
      setFormError(r.message);
      return;
    }
    setSaved("اتضاف بنجاح");
    router.push(`/fleets/${r.data.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="title-grad text-2xl font-extrabold">أسطول جديد</h1>
      <div className="max-w-xl rounded-2xl bg-white p-6 shadow">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم الأسطول</FormLabel>
                  <FormControl>
                    <Input placeholder="أسطول القاهرة" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ownerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>المالك</FormLabel>
                  <FormControl>
                    <select
                      aria-label="اختار المالك"
                      {...field}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">اختار المالك</option>
                      {owners.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name || o.email || o.phone || o.id}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ownerRoleSlug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>دور المالك الابتدائي (اختياري)</FormLabel>
                  <FormControl>
                    <Input
                      dir="ltr"
                      placeholder="fleet-owner"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || undefined)}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
            {saved && <p role="status" className="text-sm text-green-700">{saved}</p>}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "جاري الحفظ…" : "إضافة الأسطول"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
