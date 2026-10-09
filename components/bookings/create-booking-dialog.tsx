"use client";

import { useState } from "react";
import { schemaErrors, requiredField } from "@/lib/field-validation";
import { useFieldValidation } from "@/components/ui/field-validation";
import { Select } from "@/components/ui/select";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createBookingSchema } from "@/lib/schemas/p1";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { OwnerPicker } from "@/components/owners/owner-picker";
import { createBooking, type Booking } from "@/lib/actions/bookings";
import { fetchOwnerTripLinesPage, lineEndpoints } from "@/lib/actions/trip-lines";
import { fetchTripsPage, fetchTripPricing, quoteTrip } from "@/lib/actions/trips";
import { setOwnerScopeCookie } from "@/lib/owner-scope-cookie";
import { useFilterStore } from "@/stores/filters";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { InlineBlockSkeleton } from "@/components/ui/skeletons";
import { t as tr } from "@/lib/i18n/t";

type Values = z.input<typeof createBookingSchema>;

/**
 * نافذة حجز جديد — الحجز بيتعمل من غير范围 خط: رحلة موجودة. عشان كده بنختار
 * الشركة الأول، بعدين الخط، بعدين الرحلة.
 */
export function CreateBookingDialog({
  open,
  onCreated,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
  /** Extra cache hook for callers with their own list (e.g. owner tab). */
  onCreated?: (booking: Booking) => void;
}) {
  const queryClient = useQueryClient();
  const { ownerId: scopedOwnerId, setOwnerId } = useFilterStore();
  const [ownerId, setLocalOwnerId] = useState(scopedOwnerId ?? "");
  const [lineId, setLineId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: { tripId: "", passengerName: "", passengerPhone: "", boardingStationId: "", landingStationId: "", seatCount: 1 },
  });

  const { data: linesPage, isLoading: linesLoading } = useApiQuery(
    qk.tripLines(ownerId || "none"),
    () => fetchOwnerTripLinesPage(ownerId, null),
    { enabled: open && Boolean(ownerId) },
  );
  const { data: tripsPage, isLoading: tripsLoading } = useApiQuery(
    qk.trips(ownerId || "none", lineId || "none"),
    () => fetchTripsPage(ownerId, lineId, null),
    { enabled: open && Boolean(ownerId && lineId) },
  );

  const formValues = useWatch({ control: form.control });
  const tripId = formValues.tripId ?? "";
  const boarding = formValues.boardingStationId ?? "";
  const landing = formValues.landingStationId ?? "";
  const seatCount = Number(formValues.seatCount ?? 1);
  const { data: pricing, isFetching: pricingLoading, error: pricingError } = useApiQuery(
    ["trip-pricing", tripId], () => fetchTripPricing(tripId), { enabled: open && Boolean(tripId) },
  );
  const quoteQuery = useApiQuery(
    ["booking-quote", tripId, boarding, landing, seatCount],
    () => quoteTrip(tripId, { boardingStationId: boarding, landingStationId: landing, seatCount }),
    { enabled: open && Boolean(tripId && boarding && landing && Number.isInteger(seatCount) && seatCount > 0) },
  );
  const stations = pricing?.line?.stations ?? [];
  const pairs = pricing?.fares ?? [];
  const origins = stations.filter((s, i) => pairs.some(p => p.boardingStationId === s.id) && stations.findIndex(a => a.id === s.id) === i);
  const destinations = stations.filter((s, i) => pairs.some(p => p.boardingStationId === boarding && p.landingStationId === s.id) && stations.findIndex(a => a.id === s.id) === i);
  const quote = quoteQuery.data;
  const quoteReady = Boolean(quote && !quoteQuery.isFetching && !quoteQuery.error && !pricingLoading && !pricingError && quote.tripId === tripId && quote.boardingStationId === boarding && quote.landingStationId === landing && quote.seatCount === seatCount);

  const validation = useFieldValidation(() => ({ ...schemaErrors(createBookingSchema, formValues), ownerId: requiredField(ownerId), lineId: requiredField(lineId), boardingStationId: requiredField(boarding), landingStationId: requiredField(landing) }));

  function resetForm() {
    validation.reset();
    setLineId("");
    setFormError(null);
    form.reset();
  }

  async function onSubmit(values: Values) {
    setFormError(null);
    if (!ownerId) {
      setFormError(tr("bookings.createDialog.errors.pickOwner"));
      return;
    }
    setOwnerId(ownerId);
    setOwnerScopeCookie(ownerId);
    if (!quoteReady || !quote) return setFormError(tr("pricing.quoteRequired"));
    const r = await createBooking(ownerId, { ...values, seatCount, expectedUnitFare: quote.unitFare, expectedTotalAmount: quote.totalAmount });
    if (!r.ok) {
      if (r.code === "PRICE_CHANGED") {
        setFormError(tr("pricing.changed"));
        await quoteQuery.refetch();
        return;
      }
      setFormError(validation.failure(r));
      return;
    }
    // نفضّل كاش الحجوزات — الجدول بيتحدث فورًا من غير إعادة تحميل
    queryClient.invalidateQueries({ queryKey: qk.adminBookings });
    onCreated?.(r.data);
    resetForm();
    onClose();
  }

  const lines = linesPage?.items ?? [];

  return (
    <Dialog validation={validation} open={open} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title={tr("bookings.createDialog.title")} description={tr("bookings.createDialog.description")} size="sm">
      <div>
        <div className="mb-4">
          <OwnerPicker ownerId={ownerId} onOwnerChange={(id) => { setLocalOwnerId(id); setLineId(""); form.setValue("tripId", ""); form.setValue("boardingStationId", ""); form.setValue("landingStationId", ""); }} />
        </div>
        <form onSubmit={(event) => { event.preventDefault(); const valid = validation.validate(); void form.handleSubmit((values) => { if (valid) return onSubmit(values); })(event); }} className="space-y-4" noValidate>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{tr("common.fields.tripLine")}</span>
            {linesLoading ? (
              <InlineBlockSkeleton className="h-11 w-full" />
            ) : (
              <Select fieldName="lineId"
                aria-label={tr("common.fields.tripLine")}
                value={lineId}
                onChange={(event) => { setLineId(event.target.value); form.setValue("tripId", ""); form.setValue("boardingStationId", ""); form.setValue("landingStationId", ""); }}
                disabled={!ownerId}
                className="select-field w-full"
              >
                <option value="">{tr("bookings.createDialog.pickLineOption")}</option>
                {lines.map((line) => {
                  const ends = lineEndpoints(line);
                  return <option key={line.id} value={line.id}>{line.name} · {ends.origin ?? "—"} ← {ends.destination ?? "—"}</option>;
                })}
              </Select>
            )}
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{tr("bookings.createDialog.tripLabel")}<span className="text-[#dc2626]"> *</span></span>
            {tripsLoading ? (
              <InlineBlockSkeleton className="h-11 w-full" />
            ) : (
              <Select fieldName="tripId" aria-label={tr("bookings.createDialog.pickTrip")} {...form.register("tripId", { onChange: () => { form.setValue("boardingStationId", ""); form.setValue("landingStationId", ""); } })} disabled={!lineId} className="select-field w-full">
                <option value="">{tr("bookings.createDialog.pickTripOption")}</option>
                {(tripsPage?.items ?? []).map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {new Date(trip.departAt).toLocaleString("ar-EG")} · {trip.origin ?? "—"} ← {trip.destination ?? "—"}
                  </option>
                ))}
              </Select>
            )}
          </label>
          {tripId && <div className="space-y-3 rounded-2xl border border-[#cfe1ec] bg-[#f8fbfd] p-4">
            <label className="block text-sm"><span className="mb-1 block font-bold">{tr("pricing.boarding")}</span>
              <Select fieldName="boardingStationId" {...form.register("boardingStationId", { onChange: () => form.setValue("landingStationId", "") })} disabled={pricingLoading} className="select-field w-full">
                <option value="">{tr("pricing.boarding")}</option>{origins.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </label>
            <label className="block text-sm"><span className="mb-1 block font-bold">{tr("pricing.landing")}</span>
              <Select fieldName="landingStationId" {...form.register("landingStationId")} disabled={!boarding || pricingLoading} className="select-field w-full">
                <option value="">{tr("pricing.landing")}</option>{destinations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </label>
            <label className="block text-sm"><span className="mb-1 block font-bold">{tr("pricing.seats")}</span><Input fieldName="seatCount" type="number" min={1} {...form.register("seatCount", { valueAsNumber: true })} /></label>
            {pricingLoading || quoteQuery.isFetching ? <p role="status" className="text-sm">{tr("pricing.quoteLoading")}</p> : null}
            {pricingError || quoteQuery.error ? <p role="alert" className="text-sm text-red-600">{pricingError?.message ?? quoteQuery.error?.message}</p> : null}
            {quoteReady && quote ? <dl className="grid grid-cols-2 gap-2 rounded-xl bg-white p-3 text-sm">
              <dt>{tr("pricing.unitFare")}</dt><dd dir="ltr" className="text-end font-bold">{quote.unitFare} EGP</dd>
              <dt>{tr("pricing.total")}</dt><dd dir="ltr" className="text-end font-bold text-[#00134c]">{quote.totalAmount} EGP</dd>
            </dl> : null}
          </div>}
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{tr("bookings.createDialog.passengerNameLabel")}<span className="text-[#dc2626]"> *</span></span>
            <Input fieldName="passengerName" placeholder={tr("bookings.createDialog.passengerNamePlaceholder")} {...form.register("passengerName")} />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{tr("bookings.createDialog.passengerPhoneLabel")}<span className="text-[#dc2626]"> *</span></span>
            <Input fieldName="passengerPhone" dir="ltr" inputMode="tel" placeholder="01xxxxxxxxx" {...form.register("passengerPhone")} />
          </label>
          {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
            <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>{tr("common.actions.cancel")}</Button>
            <Button type="submit" variant="success" loading={form.formState.isSubmitting} disabled={!quoteReady}>
              {form.formState.isSubmitting ? tr("common.loading.saving") : tr("bookings.createDialog.submit")}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
