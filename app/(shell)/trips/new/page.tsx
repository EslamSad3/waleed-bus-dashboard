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
import { fetchTripLines, type TripLine } from "@/lib/actions/trip-lines";

type Values = z.input<typeof createTripSchema>;
type BusOpt = { id: string; registrationNumber: string; lineId?: string | null; line?: { id: string; name: string; code: string } | null };

export default function NewTripPage() {
  const router = useRouter();
  const { fleetId: scopedFleetId, setFleetId } = useFilterStore();
  const [fleetId, setLocalFleetId] = useState(scopedFleetId ?? "");
  const [buses, setBuses] = useState<BusOpt[]>([]);
  const [tripLines, setTripLines] = useState<TripLine[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(createTripSchema),
    defaultValues: { busId: "", origin: "", destination: "", departAt: "", routeId: undefined },
  });

  useEffect(() => {
    if (!fleetId) return;
    apiGet<{ items: BusOpt[] }>(`/api/fleets/${fleetId}/buses?limit=100`).then((r) => {
      if (r.ok) setBuses(r.data.items);
    });
  }, [fleetId]);

  useEffect(() => { fetchTripLines().then((result) => { if (result.ok) setTripLines(result.data.filter((line) => line.isActive)); }); }, []);

  const selectedBus = buses.find((bus) => bus.id === form.watch("busId"));
  const selectedLine = selectedBus?.lineId ? tripLines.find((line) => line.id === selectedBus.lineId) : undefined;
  const selectedDirection = selectedLine?.directions.find((item) => item.id === form.watch("routeId"));
  // From/to dropdowns read the CURRENT direction's stations (pair-aware):
  // boarding-capable rows for origin, landing-capable rows for destination.
  const boardingStops = (selectedDirection?.stations ?? []).filter(
    (station) => station.stopType === "BOARDING" || station.stopType === "BOTH",
  );
  const landingStops = (selectedDirection?.stations ?? []).filter(
    (station) => station.stopType === "LANDING" || station.stopType === "BOTH",
  );
  function selectDirection(routeId: string) {
    const direction = selectedLine?.directions.find((item) => item.id === routeId);
    form.setValue("routeId", routeId || undefined, { shouldValidate: true });
    if (direction) {
      const boarding = direction.stations.filter((s) => s.stopType === "BOARDING" || s.stopType === "BOTH");
      const landing = direction.stations.filter((s) => s.stopType === "LANDING" || s.stopType === "BOTH");
      form.setValue("origin", boarding[0]?.station.name ?? direction.origin, { shouldValidate: true });
      form.setValue("destination", landing.at(-1)?.station.name ?? direction.destination, { shouldValidate: true });
    } else {
      form.setValue("origin", "", { shouldValidate: true });
      form.setValue("destination", "", { shouldValidate: true });
    }
  }

  async function onSubmit(values: Values) {
    setFormError(null);
    if (!fleetId) {
      setFormError("اختار الأسطول الأول قبل إضافة الرحلة.");
      return;
    }
    if (!selectedBus?.lineId) {
      setFormError("عيّن خط رحلة للأتوبيس أولًا من صفحة الأتوبيس.");
      return;
    }
    if (!values.routeId) {
      setFormError("اختر اتجاه الرحلة: ذهاب أو عودة.");
      return;
    }
    // Origin must come before destination on the chosen direction (same
    // converted-pair rule as passenger booking: X → X is not a trip).
    if (values.origin === values.destination) {
      setFormError("نقطة البداية والنهاية لازم تكون مختلفة.");
      return;
    }
    if (selectedDirection) {
      const ordered = selectedDirection.stations;
      const originIdx = ordered.findIndex(
        (s) => s.station.name === values.origin && (s.stopType === "BOARDING" || s.stopType === "BOTH"),
      );
      const destIdx = [...ordered].reverse().findIndex(
        (s) => s.station.name === values.destination && (s.stopType === "LANDING" || s.stopType === "BOTH"),
      );
      const destinationIdx = destIdx === -1 ? -1 : ordered.length - 1 - destIdx;
      if (originIdx === -1 || destinationIdx === -1 || originIdx >= destinationIdx) {
        setFormError("نقطة النزول لازم تكون بعد نقطة الركوب في اتجاه الرحلة.");
        return;
      }
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
          <FleetPicker value={fleetId} onChange={(id) => { setLocalFleetId(id); form.setValue("busId", ""); form.setValue("routeId", undefined); }} />
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
                    <select aria-label="اختار الأتوبيس" {...field} onChange={(event) => { field.onChange(event); form.setValue("routeId", undefined); form.setValue("origin", ""); form.setValue("destination", ""); }} className="select-field w-full">
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
            {selectedBus && !selectedLine && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">هذا الأتوبيس لا يحمل خط رحلة بعد. ارجع إلى صفحة الأتوبيس وعيّن له خطًا أولًا.</p>}
            {selectedLine && <label className="block text-sm"><span className="mb-2 block font-bold">اتجاه الرحلة</span><select aria-label="اختار اتجاه الرحلة" value={form.watch("routeId") ?? ""} onChange={(event) => selectDirection(event.target.value)} className="select-field w-full"><option value="">اختار الذهاب أو العودة</option>{selectedLine.directions.map((direction) => <option key={direction.id} value={direction.id}>{direction.direction === "OUTBOUND" ? "ذهاب" : "عودة"} · {direction.origin} ← {direction.destination}</option>)}</select></label>}
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="origin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>من</FormLabel>
                    <FormControl>
                      <select aria-label="اختار نقطة البداية" {...field} disabled={!selectedDirection} className="select-field w-full">
                        <option value="">اختر نقطة البداية…</option>
                        {boardingStops.map((station) => (
                          <option key={`${station.id}`} value={station.station.name}>
                            {station.station.name} · {station.stopType === "BOTH" ? "ركوب ونزول" : "ركوب فقط"}
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
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>إلى</FormLabel>
                    <FormControl>
                      <select aria-label="اختار نقطة النهاية" {...field} disabled={!selectedDirection} className="select-field w-full">
                        <option value="">اختر نقطة النهاية…</option>
                        {landingStops.map((station) => (
                          <option key={`${station.id}`} value={station.station.name}>
                            {station.station.name} · {station.stopType === "BOTH" ? "ركوب ونزول" : "نزول فقط"}
                          </option>
                        ))}
                      </select>
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
