"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { updateTrip, TRIP_STATUS_AR, type Trip } from "@/lib/actions/trips";
import { useFilterStore } from "@/stores/filters";
import { qk, upsertInCursorList, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

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
  const [status, setStatus] = useState<Trip["status"]>("SCHEDULED");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (trip && trip.id !== loadedFor) {
    setLoadedFor(trip.id);
    // datetime-local محتاج الشكل YYYY-MM-DDTHH:mm من غير الثانية والزون
    setDepartAt(trip.departAt.slice(0, 16));
    setFare(trip.fare ?? "");
    setStatus(trip.status);
    setError(null);
  }

  function resetForm() {
    setLoadedFor(null);
    setError(null);
  }

  async function submit() {
    if (!trip || !ownerId) return;
    if (!departAt) {
      setError(t("trips.editDialog.errors.required"));
      return;
    }
    setSaving(true);
    const result = await updateTrip(ownerId, lineId, trip.id, {
      departAt: new Date(departAt).toISOString(),
      fare: fare.trim(),
      status,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    upsertInCursorList<TripRow>(queryClient, qk.trips(ownerId, lineId), {
      ...result.data,
      busName: trip.busName,
      driverName: trip.driverName,
    });
    resetForm();
    onClose();
  }

  return (
    <Dialog
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
            <Input dir="ltr" type="datetime-local" value={departAt} onChange={(event) => setDepartAt(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.fare")}</span>
            <Input dir="ltr" inputMode="decimal" value={fare} onChange={(event) => setFare(event.target.value)} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.status")}</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as Trip["status"])} className="select-field w-full">
            {(Object.keys(TRIP_STATUS_AR) as Trip["status"][]).map((value) => (
              <option key={value} value={value}>{TRIP_STATUS_AR[value]}</option>
            ))}
          </select>
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
