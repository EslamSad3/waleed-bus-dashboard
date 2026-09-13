"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createBookingSchema } from "@/lib/schemas/p1";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createBooking } from "@/lib/actions/bookings";
import { apiGet } from "@/lib/actions/http";
import { useFilterStore } from "@/stores/filters";
import { FleetPicker } from "@/components/fleet-picker";
import { setFleetScopeCookie } from "@/lib/fleet-scope-cookie";

type Values = z.input<typeof createBookingSchema>;
type TripOpt = { id: string; origin: string; destination: string };

export default function NewBookingPage() {
  const router = useRouter();
  const { fleetId: scopedFleetId, setFleetId } = useFilterStore();
  const [fleetId, setLocalFleetId] = useState(scopedFleetId ?? "");
  const [trips, setTrips] = useState<TripOpt[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: { tripId: "", passengerName: "", passengerPhone: "" },
  });

  useEffect(() => {
    if (!fleetId) return;
    apiGet<{ items: TripOpt[] }>(`/api/fleets/${fleetId}/trips?limit=100`).then((r) => {
      if (r.ok) setTrips(r.data.items);
    });
  }, [fleetId]);

  async function onSubmit(values: Values) {
    setFormError(null);
    if (!fleetId) {
      setFormError("اختار الأسطول الأول قبل إضافة الحجز.");
      return;
    }
    setFleetId(fleetId);
    setFleetScopeCookie(fleetId);
    const r = await createBooking(fleetId, { ...values, passengerPhone: values.passengerPhone || undefined });
    if (!r.ok) {
      if (r.fields) {
        for (const [key, msg] of Object.entries(r.fields)) {
          if (key === "tripId" || key === "passengerName" || key === "passengerPhone") {
            form.setError(key, { message: msg });
          }
        }
      }
      setFormError(r.message);
      return;
    }
    router.push(`/bookings/${r.data.id}`);
    router.refresh();
  }

  return (
    <div className="dashboard-page">
      <div><h1 className="page-title">حجز جديد</h1><p className="page-description">سجّل بيانات الراكب واربط الحجز بالرحلة المطلوبة.</p></div>
      <div className="form-card max-w-xl">
        <div className="mb-4">
          <FleetPicker value={fleetId} onChange={(id) => { setLocalFleetId(id); form.setValue("tripId", ""); }} />
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="tripId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الرحلة (من نفس الأسطول)</FormLabel>
                  <FormControl>
                    <select aria-label="اختار الرحلة" {...field} className="select-field w-full">
                      <option value="">اختار الرحلة</option>
                      {trips.map((t) => (
                        <option key={t.id} value={t.id}>{t.origin} ← {t.destination}</option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passengerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم الراكب</FormLabel>
                  <FormControl>
                    <Input placeholder="اسم الراكب" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passengerPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>موبايل الراكب (اختياري)</FormLabel>
                  <FormControl>
                    <Input
                      dir="ltr"
                      inputMode="tel"
                      placeholder="01xxxxxxxxx"
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
            <Button className="w-full sm:w-auto" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "جاري الحفظ…" : "إضافة الحجز"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
