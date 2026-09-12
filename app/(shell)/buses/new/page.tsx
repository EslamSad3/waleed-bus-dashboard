"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createBusSchema } from "@/lib/schemas/p1";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createBus } from "@/lib/actions/buses";
import { useFilterStore } from "@/stores/filters";
import { FleetPicker } from "@/components/fleet-picker";
import { setFleetScopeCookie } from "@/lib/fleet-scope-cookie";

type Values = z.input<typeof createBusSchema>;

export default function NewBusPage() {
  const router = useRouter();
  const { fleetId: scopedFleetId, setFleetId } = useFilterStore();
  const [fleetId, setLocalFleetId] = useState(scopedFleetId ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(createBusSchema),
    defaultValues: { registrationNumber: "", plateNumber: "", capacity: undefined as unknown as number },
  });

  async function onSubmit(values: Values) {
    setFormError(null);
    if (!fleetId) {
      setFormError("اختار الأسطول الأول (x-fleet-id)");
      return;
    }
    setFleetId(fleetId);
    setFleetScopeCookie(fleetId);
    const r = await createBus(fleetId, { ...values, plateNumber: values.plateNumber || undefined });
    if (!r.ok) {
      if (r.fields) {
        for (const [key, msg] of Object.entries(r.fields)) {
          if (key === "registrationNumber" || key === "plateNumber" || key === "capacity") {
            form.setError(key, { message: msg });
          }
        }
      }
      setFormError(r.message);
      return;
    }
    router.push(`/buses/${r.data.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="title-grad text-2xl font-extrabold">أتوبيس جديد</h1>
      <div className="max-w-xl rounded-2xl bg-white p-6 shadow">
        <div className="mb-4">
          <FleetPicker value={fleetId} onChange={setLocalFleetId} />
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="registrationNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>رقم التسجيل</FormLabel>
                  <FormControl>
                    <Input dir="ltr" placeholder="BUS-A-002" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="plateNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>رقم اللوحة (اختياري)</FormLabel>
                  <FormControl>
                    <Input
                      dir="ltr"
                      placeholder="ABC-1234"
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
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>السعة (1–300)</FormLabel>
                  <FormControl>
                    <Input
                      dir="ltr"
                      inputMode="numeric"
                      type="number"
                      min={1}
                      max={300}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "جاري الحفظ…" : "إضافة الأتوبيس"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
