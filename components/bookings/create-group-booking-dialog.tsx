"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { schemaErrors, requiredField } from "@/lib/field-validation";
import { useFieldValidation } from "@/components/ui/field-validation";
import { Select, Textarea } from "@/components/ui/select";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { staffBookingOrderFormSchema, type StaffBookingOrderFormValues } from "@/lib/schemas/p1";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { OwnerPicker } from "@/components/owners/owner-picker";
import { fetchOwnerTripLinesPage, lineEndpoints } from "@/lib/actions/trip-lines";
import { fetchTripsPage, fetchTripPricing } from "@/lib/actions/trips";
import { quoteStaffBookingOrder, createStaffBookingOrder } from "@/lib/actions/booking-orders";
import {
  fingerprintOrderPayload,
  keyForPayload,
  normalizeOrderPhone,
  resolveOrderPayload,
  settleFailedPayload,
  type PendingOrderKeys,
} from "@/lib/booking-order-idempotency";
import { setOwnerScopeCookie } from "@/lib/owner-scope-cookie";
import { useFilterStore } from "@/stores/filters";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { InlineBlockSkeleton } from "@/components/ui/skeletons";
import { Plus, X } from "lucide-react";
import { t as tr } from "@/lib/i18n/t";

type Values = StaffBookingOrderFormValues;

type QuoteRow = [boarding: string, landing: string, seats: number];

const EMPTY_ROW = {
  boardingStationId: "",
  landingStationId: "",
  seatCount: 1,
  passengerName: "",
  passengerPhone: "",
};

const PAYMENT_METHODS = ["CASH", "VODAFONE_CASH", "ORANGE_MONEY", "ETISALAT_CASH", "WE_PAY", "CARD"] as const;

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: tr("enums.paymentMethod.cashAlt"),
  VODAFONE_CASH: tr("enums.paymentMethod.vodafoneCash"),
  ORANGE_MONEY: tr("enums.paymentMethod.orangeMoney"),
  ETISALAT_CASH: tr("enums.paymentMethod.etisalatCash"),
  WE_PAY: tr("enums.paymentMethod.wePay"),
  CARD: tr("enums.paymentMethod.bankCard"),
};

/** Quote calls are keyed by the stop pairs + seats only — typing a name never refires them. */
function rowsKey(items: { boardingStationId?: string; landingStationId?: string; seatCount?: number | string }[] | undefined): string {
  return JSON.stringify(
    (items ?? []).map(
      (item): QuoteRow => [
        item?.boardingStationId ?? "",
        item?.landingStationId ?? "",
        Number(item?.seatCount ?? 0),
      ],
    ),
  );
}

function rowComplete(row: QuoteRow): boolean {
  return Boolean(row[0] && row[1] && Number.isInteger(row[2]) && row[2] >= 1);
}

/**
 * Grouped staff checkout — one trip, 1..10 passengers, each with their own
 * pickup/drop-off. Same owner → line → trip cascade as the single booking
 * dialog, then one combined quote for all rows before submit.
 */
export function CreateGroupBookingDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { ownerId: scopedOwnerId, setOwnerId } = useFilterStore();
  const [ownerId, setLocalOwnerId] = useState(scopedOwnerId ?? "");
  const [lineId, setLineId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  // Replay keys are bound to exact submitted payloads, not to the dialog
  // session: an unchanged retry reuses its key, any edit mints a fresh one,
  // and several unresolved submissions coexist. The map survives closing and
  // reopening while the page is mounted; a success removes only its own entry.
  const pendingRef = useRef<PendingOrderKeys>(new Map());

  const form = useForm<Values>({
    resolver: zodResolver(staffBookingOrderFormSchema),
    defaultValues: { tripId: "", paymentMethod: "CASH", note: "", items: [{ ...EMPTY_ROW }] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

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
  const { data: pricing, isFetching: pricingLoading, error: pricingError } = useApiQuery(
    ["trip-pricing", tripId], () => fetchTripPricing(tripId), { enabled: open && Boolean(tripId) },
  );
  const stations = pricing?.line?.stations ?? [];
  const pairs = pricing?.fares ?? [];
  const origins = stations.filter((s, i) => pairs.some(p => p.boardingStationId === s.id) && stations.findIndex(a => a.id === s.id) === i);

  // Debounced quote: fires once per settled set of rows, not per keystroke.
  const key = rowsKey(formValues.items);
  const [debouncedKey, setDebouncedKey] = useState(key);
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedKey(key), 500);
    return () => clearTimeout(handle);
  }, [key]);
  const debouncedRows = useMemo(() => JSON.parse(debouncedKey) as QuoteRow[], [debouncedKey]);
  const quoteReadyRows = debouncedRows.length > 0 && debouncedRows.length <= 10 && debouncedRows.every(rowComplete);
  const quoteQuery = useApiQuery(
    ["admin-booking-order-quote", tripId, debouncedKey],
    () => quoteStaffBookingOrder({
      tripId,
      items: debouncedRows.map(([boardingStationId, landingStationId, seatCount]) => ({ boardingStationId, landingStationId, seatCount })),
    }),
    { enabled: open && Boolean(tripId) && quoteReadyRows },
  );
  const quote = quoteQuery.data;
  const quoteFresh = Boolean(
    quote && !quoteQuery.isFetching && !quoteQuery.error && !pricingLoading && !pricingError
    && quote.tripId === tripId && debouncedKey === key && quote.items.length === debouncedRows.length,
  );

  function rowQuote(index: number): { unitFare: string; totalAmount: string } | undefined {
    if (!quoteFresh || !quote) return undefined;
    const row = (formValues.items ?? [])[index];
    const item = quote.items[index];
    if (!row || !item) return undefined;
    if (item.boardingStationId !== row.boardingStationId || item.landingStationId !== row.landingStationId || item.seatCount !== Number(row.seatCount)) return undefined;
    return item;
  }

  const validation = useFieldValidation(() => ({ ...schemaErrors(staffBookingOrderFormSchema, formValues), ownerId: requiredField(ownerId), lineId: requiredField(lineId) }));

  function clearRowStations() {
    form.setValue(
      "items",
      (form.getValues("items") ?? []).map((item) => ({ ...item, boardingStationId: "", landingStationId: "" })),
    );
  }

  function resetForm() {
    validation.reset();
    setLineId("");
    setFormError(null);
    form.reset({ tripId: "", paymentMethod: "CASH", note: "", items: [{ ...EMPTY_ROW }] });
  }

  async function onSubmit(values: Values) {
    setFormError(null);
    if (!ownerId) {
      setFormError(tr("bookings.groupOrder.errors.pickOwner"));
      return;
    }
    setOwnerId(ownerId);
    setOwnerScopeCookie(ownerId);
    if (!quoteFresh || !quote) return setFormError(tr("pricing.quoteRequired"));
    const note = values.note?.trim() ? values.note.trim() : undefined;
    const orderItems = values.items.map((item) => ({
      boardingStationId: item.boardingStationId,
      landingStationId: item.landingStationId,
      seatCount: Number(item.seatCount),
      passengerName: item.passengerName.trim(),
      passengerPhone: normalizeOrderPhone(item.passengerPhone.trim()),
    }));
    const fingerprint = fingerprintOrderPayload({ tripId: values.tripId, paymentMethod: values.paymentMethod, note, items: orderItems });
    const keyed = keyForPayload(pendingRef.current, fingerprint, () => crypto.randomUUID());
    pendingRef.current = keyed.pending;
    const key = keyed.key;
    const r = await createStaffBookingOrder({
      tripId: values.tripId,
      paymentMethod: values.paymentMethod,
      expectedTotalAmount: quote.totalAmount,
      note,
      idempotencyKey: key,
      items: orderItems,
    });
    if (!r.ok) {
      pendingRef.current = settleFailedPayload(pendingRef.current, fingerprint, r.code);
      if (r.code === "PRICE_CHANGED") {
        setFormError(tr("pricing.changed"));
        await quoteQuery.refetch();
        return;
      }
      setFormError(validation.failure(r));
      return;
    }
    queryClient.invalidateQueries({ queryKey: qk.adminBookings });
    pendingRef.current = resolveOrderPayload(pendingRef.current, fingerprint);
    resetForm();
    onClose();
  }

  const lines = linesPage?.items ?? [];
  const quoteLoading = quoteQuery.isFetching || debouncedKey !== key;

  return (
    <Dialog validation={validation} open={open} onOpenChange={(next) => { if (!next) { if (form.formState.isSubmitting) return; resetForm(); onClose(); } }} title={tr("bookings.groupOrder.title")} description={tr("bookings.groupOrder.description")} size="lg">
      <div>
        <div className="mb-4">
          <OwnerPicker ownerId={ownerId} onOwnerChange={(id) => { setLocalOwnerId(id); setLineId(""); form.setValue("tripId", ""); clearRowStations(); }} />
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
                onChange={(event) => { setLineId(event.target.value); form.setValue("tripId", ""); clearRowStations(); }}
                disabled={!ownerId}
                className="select-field w-full"
              >
                <option value="">{tr("bookings.groupOrder.pickLineOption")}</option>
                {lines.map((line) => {
                  const ends = lineEndpoints(line);
                  return <option key={line.id} value={line.id}>{line.name} · {ends.origin ?? "—"} ← {ends.destination ?? "—"}</option>;
                })}
              </Select>
            )}
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{tr("bookings.groupOrder.tripLabel")}<span className="text-[#dc2626]"> *</span></span>
            {tripsLoading ? (
              <InlineBlockSkeleton className="h-11 w-full" />
            ) : (
              <Select fieldName="tripId" aria-label={tr("bookings.groupOrder.pickTripOption")} {...form.register("tripId", { onChange: () => clearRowStations() })} disabled={!lineId} className="select-field w-full">
                <option value="">{tr("bookings.groupOrder.pickTripOption")}</option>
                {(tripsPage?.items ?? []).map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {new Date(trip.departAt).toLocaleString("ar-EG")} · {trip.origin ?? "—"} ← {trip.destination ?? "—"}
                  </option>
                ))}
              </Select>
            )}
          </label>

          {tripId ? (
            <div className="space-y-3">
              <p className="text-sm font-bold text-[#334454]">{tr("bookings.groupOrder.passengersTitle", { count: fields.length })}</p>
              {fields.map((field, index) => {
                const boarding = formValues.items?.[index]?.boardingStationId ?? "";
                const destinations = stations.filter((s, i) => pairs.some(p => p.boardingStationId === boarding && p.landingStationId === s.id) && stations.findIndex(a => a.id === s.id) === i);
                const fare = rowQuote(index);
                return (
                  <div key={field.id} className="space-y-3 rounded-2xl border border-[#cfe1ec] bg-[#f8fbfd] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#00134c]">{tr("bookings.groupOrder.passengerTitle", { index: index + 1 })}</span>
                      <Button type="button" size="sm" variant="ghost" aria-label={tr("bookings.groupOrder.removePassenger", { index: index + 1 })} disabled={fields.length <= 1} onClick={() => remove(index)}>
                        <X className="size-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm">
                        <span className="mb-1 block font-bold">{tr("bookings.groupOrder.passengerNameLabel")}<span className="text-[#dc2626]"> *</span></span>
                        <Input fieldName={`items.${index}.passengerName`} placeholder={tr("bookings.groupOrder.passengerNamePlaceholder")} {...form.register(`items.${index}.passengerName`)} />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-bold">{tr("bookings.groupOrder.passengerPhoneLabel")}<span className="text-[#dc2626]"> *</span></span>
                        <Input fieldName={`items.${index}.passengerPhone`} dir="ltr" inputMode="tel" placeholder="01xxxxxxxxx" {...form.register(`items.${index}.passengerPhone`)} />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-bold">{tr("pricing.boarding")}<span className="text-[#dc2626]"> *</span></span>
                        <Select fieldName={`items.${index}.boardingStationId`} {...form.register(`items.${index}.boardingStationId`, { onChange: () => form.setValue(`items.${index}.landingStationId`, "") })} disabled={pricingLoading} className="select-field w-full">
                          <option value="">{tr("bookings.groupOrder.pickBoardingOption")}</option>{origins.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-bold">{tr("pricing.landing")}<span className="text-[#dc2626]"> *</span></span>
                        <Select fieldName={`items.${index}.landingStationId`} {...form.register(`items.${index}.landingStationId`)} disabled={!boarding || pricingLoading} className="select-field w-full">
                          <option value="">{tr("bookings.groupOrder.pickLandingOption")}</option>{destinations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-bold">{tr("bookings.groupOrder.seatsLabel")}<span className="text-[#dc2626]"> *</span></span>
                        <Input fieldName={`items.${index}.seatCount`} type="number" min={1} {...form.register(`items.${index}.seatCount`, { valueAsNumber: true })} />
                      </label>
                      {fare ? (
                        <dl className="grid grid-cols-2 content-center gap-2 rounded-xl bg-white p-3 text-sm">
                          <dt>{tr("pricing.unitFare")}</dt><dd dir="ltr" className="text-end font-bold">{fare.unitFare} {tr("pricing.currencyLabel")}</dd>
                          <dt>{tr("bookings.groupOrder.rowTotal")}</dt><dd dir="ltr" className="text-end font-bold text-[#00134c]">{fare.totalAmount} {tr("pricing.currencyLabel")}</dd>
                        </dl>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {fields.length < 10 ? (
                <Button type="button" variant="outline" size="sm" onClick={() => append({ ...EMPTY_ROW })}>
                  <Plus className="size-4" /> {tr("bookings.groupOrder.addPassenger")}
                </Button>
              ) : null}

              {quoteLoading ? <p role="status" className="text-sm">{tr("pricing.quoteLoading")}</p> : null}
              {pricingError || quoteQuery.error ? <p role="alert" className="text-sm text-red-600">{pricingError?.message ?? quoteQuery.error?.message}</p> : null}
              {!quoteFresh && !quoteLoading && !(pricingError || quoteQuery.error) ? (
                <p role="status" className="text-sm text-[#5e6b78]">{quoteReadyRows ? tr("bookings.groupOrder.quoteStale") : tr("bookings.groupOrder.quoteWaiting")}</p>
              ) : null}
              {quoteFresh && quote ? (
                <dl className="grid grid-cols-2 gap-2 rounded-xl bg-white p-3 text-sm ring-1 ring-[#cfe1ec]">
                  <dt>{tr("bookings.groupOrder.combinedSeats")}</dt><dd className="text-end font-bold">{quote.totalSeats}</dd>
                  <dt>{tr("pricing.subtotal")}</dt><dd dir="ltr" className="text-end font-bold">{quote.subtotalAmount} {tr("pricing.currencyLabel")}</dd>
                  <dt>{tr("bookings.groupOrder.combinedTotal")}</dt><dd dir="ltr" className="text-end font-bold text-[#00134c]">{quote.totalAmount} {tr("pricing.currencyLabel")}</dd>
                </dl>
              ) : null}
            </div>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{tr("bookings.groupOrder.paymentMethodLabel")}<span className="text-[#dc2626]"> *</span></span>
            <Select fieldName="paymentMethod" aria-label={tr("bookings.groupOrder.paymentMethodLabel")} {...form.register("paymentMethod")} className="select-field w-full">
              {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{PAYMENT_METHOD_LABEL[method]}</option>)}
            </Select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{tr("bookings.groupOrder.noteLabel")}</span>
            <Textarea fieldName="note" rows={2} placeholder={tr("bookings.groupOrder.notePlaceholder")} {...form.register("note")} className="w-full rounded-xl border border-[#d8e4ec] bg-white p-3 text-sm text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059ff8]" />
          </label>
          {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
            <Button type="button" variant="danger" disabled={form.formState.isSubmitting} onClick={() => { resetForm(); onClose(); }}>{tr("common.actions.cancel")}</Button>
            <Button type="submit" variant="success" loading={form.formState.isSubmitting} disabled={!quoteFresh}>
              {form.formState.isSubmitting ? tr("common.loading.saving") : tr("bookings.groupOrder.submit")}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
