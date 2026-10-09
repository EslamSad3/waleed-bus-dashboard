"use client";

import { Select } from "@/components/ui/select";
import { DriverPicker } from "@/components/buses/driver-picker";

import * as schemas from "@/lib/schemas/p1";

import { schemaErrors } from "@/lib/field-validation";

import { useFieldValidation } from "@/components/ui/field-validation";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { updateTrip, TRIP_STATUS_AR, type Trip } from "@/lib/actions/trips";
import { useFilterStore } from "@/stores/filters";
import { qk, upsertInCursorList, useQueryClient } from "@/lib/queries";
import { applyMutationCache, tripImpact } from "@/lib/cache/mutations";
import { t } from "@/lib/i18n/t";
import { editedDeparture, toLocalDateTimeInput } from "@/lib/trip-edit-time";

type TripRow = Trip & { busName?: string; driverName?: string };

/**
 * نافذة تعديل رحلة — الميعاد والسعر والحالة بس. الخط والعربية والوجهة مش
 * بيتغيروا من هنا (الرحلة ورا خط واحد)، والعربية بتتغير من صفحة العربية.
 */
export function EditTripDialog({
  open,
  trip,
  lineId,
  onClose,
}: {
  open: boolean;
  trip: TripRow | null;
  /** The trip's line — trips are addressed by (owner, line, trip). */
  lineId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const ownerId = useFilterStore((s) => s.ownerId);
  const [departAt, setDepartAt] = useState("");
  const [fare, setFare] = useState("");
  const [driverUserId, setDriverUserId] = useState("");
  const [status, setStatus] = useState<Trip["status"]>("SCHEDULED");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (trip && trip.id !== loadedFor) {
    setLoadedFor(trip.id);
    // datetime-local محتاج الشكل YYYY-MM-DDTHH:mm من غير الثانية والزون
    setDepartAt(toLocalDateTimeInput(trip.departAt));
    setFare(trip.fare ?? "");
    setStatus(trip.status);
    setDriverUserId(trip.driverUserId ?? "");
    setError(null);
  }

  function resetForm() {
    validation.reset();
    setLoadedFor(null);
    setError(null);
  }

  const validation = useFieldValidation(() => schemaErrors(schemas.updateTripSchema, { departAt, fare: trip?.pricingEnabled ? undefined : fare.trim() || undefined, status, ...(trip?.status === "SCHEDULED" ? { driverUserId } : {}) }));

  async function submit() {
    if (!validation.validate()) return;
    if (!trip) return;
    // The trip's OWN owner, not the global filter: the dialog can be open while
    // the operator has already switched the page-level company.
    const tripOwnerId = trip.ownerId || ownerId;
    if (!tripOwnerId) return;

    setSaving(true);
    const result = await updateTrip(tripOwnerId, lineId, trip.id, {
      departAt: editedDeparture(trip.departAt, departAt),
      fare: trip?.pricingEnabled ? undefined : fare.trim() || undefined,
      status,
      ...(trip.status === "SCHEDULED" && driverUserId !== trip.driverUserId ? { driverUserId } : {}),
    });
    setSaving(false);
    if (!result.ok) {
      setError(validation.failure(result));
      return;
    }
    // The global `all` index was left stale before, so an edit made from a
    // detail page or from a different owner view only showed up on the owner/line
    // key. One impact declaration now patches the index, the owner list, the
    // line list, and the detail slot together.
    applyMutationCache(
      queryClient,
      tripImpact({ trip: { id: trip.id, ownerId: tripOwnerId, lineId }, mode: "update" }),
      result,
    );
    upsertInCursorList<TripRow>(queryClient, qk.trips(tripOwnerId, lineId), {
      ...result.data,
      busName: trip.busName,
      driverName: trip.driverName,
    });
    resetForm();
    onClose();
  }

  return (
    <Dialog validation={validation}
      open={open && Boolean(trip)}
      onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }}
      title={t("trips.editDialog.title")}
      description={trip ? t("trips.editDialog.description", { tripOrigin: trip.origin ?? "—", tripDestination: trip.destination ?? "—", tripBusName: trip.busName ?? "" }) : undefined}
      size="sm"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.origin")}</span>
            <Input value={trip?.origin ?? ""} readOnly dir="rtl" />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.destination")}</span>
            <Input value={trip?.destination ?? ""} readOnly dir="rtl" />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("trips.columns.departAt")}</span>
            <Input fieldName="departAt" dir="ltr" type="datetime-local" value={departAt} onChange={(event) => setDepartAt(event.target.value)} />
          </label>
          {trip?.pricingEnabled ? <p className="self-center text-sm text-slate-600">{t("pricing.managedOnLine")}</p> : <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.fare")}</span>
            <Input fieldName="fare" dir="ltr" inputMode="decimal" value={fare} onChange={(event) => setFare(event.target.value)} />
          </label>}
        </div>
        {trip?.status === "SCHEDULED" ? <fieldset disabled={saving}><DriverPicker ownerId={trip.ownerId} value={driverUserId} onChange={setDriverUserId} /><p className="text-xs text-[#687886]">{t("tripAssignment.notice")}</p></fieldset> : null}
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.status")}</span>
          <Select fieldName="status" value={status} onChange={(event) => setStatus(event.target.value as Trip["status"])} className="select-field w-full">
            {(Object.keys(TRIP_STATUS_AR) as Trip["status"][]).filter((value) => trip?.status === "SCHEDULED" || value !== "SCHEDULED").map((value) => (
              <option key={value} value={value}>{TRIP_STATUS_AR[value]}</option>
            ))}
          </Select>
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>{t("common.actions.cancel")}</Button>
          <Button type="button" variant="success" onClick={() => void submit()} loading={saving}>{saving ? t("common.loading.saving") : t("common.actions.saveChanges")}</Button>
        </div>
      </div>
    </Dialog>
  );
}
