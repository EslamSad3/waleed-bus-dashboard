"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createTripSchema } from "@/lib/schemas/p1";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTrip } from "@/lib/actions/trips";
import { apiGet } from "@/lib/actions/http";
import { useFilterStore } from "@/stores/filters";
import { FleetPicker } from "@/components/fleet-picker";
import { setFleetScopeCookie } from "@/lib/fleet-scope-cookie";

type Values = z.input<typeof createTripSchema>;
type BusOpt = { id: string; registrationNumber: string };

export default function NewTripPage() {
  const router = useRouter();
  const { fleetId: scopedFleetId, setFleetId } = useFilterStore();
  const [fleetId, setLocalFleetId] = useState(scopedFleetId ?? "");
  const [buses, setBuses] = useState<BusOpt[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(createTripSchema),
    defaultValues: { busId: "", origin: "", destination: "", departAt: "" },
  });

  useEffect(() => {
    if (!fleetId) return;
    apiGet<{ items: BusOpt[] }>(`/api/fleets/${fleetId}/buses?limit=100`).then((r) => {
      if (r.ok) setBuses(r.data.items);
    });
  }, [fleetId]);

  async function onSubmit(values: Values) {
    setFormError(null);
    if (!fleetId) {
      setFormError("اختار الأسطول الأول قبل إضافة الرحلة.");
      return;
    }
    setFleetId(fleetId);
    setFleetScopeCookie(fleetId);
    const r = await createTrip(fleetId, values);
    if (!r.ok) {
      if (r.fields) {
        for (const [key, msg] of Object.entries(r.fields)) {
          if (key === "busId" || key === "origin" || key === "destination" || key === "departAt") {
            form.setError(key, { message: msg });
          }
        }
      }
      setFormError(r.message);
      return;
    }
    router.push(`/trips/${r.data.id}`);
    router.refresh();
  }

  return (
    <div className="dashboard-page">
      <div><h1 className="page-title">رحلة جديدة</h1><p className="page-description">اختر الأتوبيس وحدد خط الرحلة وميعاد المغادرة.</p></div>
      <div className="form-card max-w-xl">
        <div className="mb-4">
          <FleetPicker value={fleetId} onChange={(id) => { setLocalFleetId(id); form.setValue("busId", ""); }} />
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="busId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الأتوبيس (من نفس الأسطول)</FormLabel>
                  <FormControl>
                    <select aria-label="اختار الأتوبيس" {...field} className="select-field w-full">
                      <option value="">اختار الأتوبيس</option>
                      {buses.map((b) => (
                        <option key={b.id} value={b.id}>{b.registrationNumber}</option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="origin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>من</FormLabel>
                    <FormControl>
                      <Input placeholder="القاهرة" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>إلى</FormLabel>
                    <FormControl>
                      <Input placeholder="الإسكندرية" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="departAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ميعاد المغادرة</FormLabel>
                  <FormControl>
                    <Input dir="ltr" type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
            <Button className="w-full sm:w-auto" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "جاري الحفظ…" : "إضافة الرحلة"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
