"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createBookingSchema } from "@/lib/schemas/p1";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { createBooking, type Booking } from "@/lib/actions/bookings";
import { apiGet, type CursorPage } from "@/lib/actions/http";
import { useFilterStore } from "@/stores/filters";
import { FleetPicker } from "@/components/fleet-picker";
import { setFleetScopeCookie } from "@/lib/fleet-scope-cookie";
import { useApiQuery, useQueryClient } from "@/lib/queries";
import { InlineBlockSkeleton } from "@/components/ui/skeletons";

type Values = z.input<typeof createBookingSchema>;
type TripOpt = { id: string; origin: string; destination: string };

/** نافذة حجز جديد — بتفتح في صفحة الحجوزات نفسها من غير تنقل. */
export function CreateBookingDialog({
  open,
  onCreated,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
  /** Extra cache hook for callers with their own list (e.g. fleet tab). */
  onCreated?: (booking: Booking) => void;
}) {
  const queryClient = useQueryClient();
  const { fleetId: scopedFleetId, setFleetId } = useFilterStore();
  const [fleetId, setLocalFleetId] = useState(scopedFleetId ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: { tripId: "", passengerName: "", passengerPhone: "" },
  });

  const { data: tripsPage, isLoading: tripsLoading } = useApiQuery<CursorPage<TripOpt>>(
    ["booking-dialog-trips", fleetId],
    () => apiGet<CursorPage<TripOpt>>(`/api/fleets/${fleetId}/trips?limit=100`),
    { enabled: open && Boolean(fleetId) },
  );
  const trips = tripsPage?.items ?? [];

  function resetForm() {
    setFormError(null);
    form.reset();
  }

  async function onSubmit(values: Values) {
    setFormError(null);
    if (!fleetId) {
      setFormError("اختار الأسطول الأول قبل إضافة الحجز.");
      return;
    }
    setFleetId(fleetId);
    setFleetScopeCookie(fleetId);
    const r = await createBooking(fleetId, values);
    if (!r.ok) {
      setFormError(r.message);
      return;
    }
    // نفضّل كاش الحجوزات — الجدول بيتحدث فورًا من غير إعادة تحميل
    queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    onCreated?.(r.data);
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title="حجز جديد" description="سجّل بيانات الراكب واربط الحجز بالرحلة المطلوبة." size="sm">
      <div>
        <div className="mb-4">
          <FleetPicker value={fleetId} onChange={(id) => { setLocalFleetId(id); form.setValue("tripId", ""); }} />
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">الرحلة (من نفس الأسطول)<span className="text-[#dc2626]"> *</span></span>
            {tripsLoading ? (
              <InlineBlockSkeleton className="h-11 w-full" />
            ) : (
              <select aria-label="اختار الرحلة" {...form.register("tripId")} className="select-field w-full">
                <option value="">اختار الرحلة</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>{t.origin} ← {t.destination}</option>
                ))}
              </select>
            )}
            {form.formState.errors.tripId ? <p role="alert" className="mt-1 text-sm text-red-600">{form.formState.errors.tripId.message}</p> : null}
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">اسم الراكب<span className="text-[#dc2626]"> *</span></span>
            <Input placeholder="اسم الراكب" {...form.register("passengerName")} />
            {form.formState.errors.passengerName ? <p role="alert" className="mt-1 text-sm text-red-600">{form.formState.errors.passengerName.message}</p> : null}
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">موبايل الراكب<span className="text-[#dc2626]"> *</span></span>
            <Input dir="ltr" inputMode="tel" placeholder="01xxxxxxxxx" {...form.register("passengerPhone")} />
            {form.formState.errors.passengerPhone ? <p role="alert" className="mt-1 text-sm text-red-600">{form.formState.errors.passengerPhone.message}</p> : null}
          </label>
          {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
            <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>إلغاء</Button>
            <Button type="submit" variant="success" loading={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "جاري الحفظ…" : "إضافة الحجز"}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
