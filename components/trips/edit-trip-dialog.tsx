"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { updateTrip, TRIP_STATUS_AR, type Trip } from "@/lib/actions/trips";
import { qk, upsertInCursorList, useQueryClient } from "@/lib/queries";

type TripRow = Trip & { fleetName?: string; busName?: string; driverName?: string };

/**
 * نافذة تعديل رحلة — البداية والوجهة والميعاد والحالة. العربية مش بتتغير من هنا
 * (لأن الرحلة مربوطة بخط ومحطات) — تغيير العربية من صفحة العربية نفسها.
 */
export function EditTripDialog({
  open,
  trip,
  onClose,
}: {
  open: boolean;
  trip: TripRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departAt, setDepartAt] = useState("");
  const [status, setStatus] = useState<Trip["status"]>("SCHEDULED");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (trip && trip.id !== loadedFor) {
    setLoadedFor(trip.id);
    setOrigin(trip.origin);
    setDestination(trip.destination);
    // datetime-local محتاج الشكل YYYY-MM-DDTHH:mm من غير الثانية والزون
    setDepartAt(trip.departAt.slice(0, 16));
    setStatus(trip.status);
    setError(null);
  }

  function resetForm() {
    setLoadedFor(null);
    setError(null);
  }

  async function submit() {
    if (!trip) return;
    setError(null);
    if (!origin.trim() || !destination.trim() || !departAt) {
      setError("أكمل البداية والوجهة والميعاد.");
      return;
    }
    setSaving(true);
    const result = await updateTrip(trip.fleetId, trip.id, {
      origin: origin.trim(),
      destination: destination.trim(),
      departAt: new Date(departAt).toISOString(),
      status,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    upsertInCursorList<TripRow>(queryClient, qk.trips(null), { ...result.data, fleetName: trip.fleetName, busName: trip.busName, driverName: trip.driverName });
    upsertInCursorList<Trip>(queryClient, qk.fleetTrips(trip.fleetId), result.data);
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open && Boolean(trip)} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title="تعديل رحلة" description={trip ? `رحلة ${trip.origin} → ${trip.destination} — عربية ${trip.busName}.` : undefined} size="sm">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">البداية</span>
            <Input value={origin} onChange={(event) => setOrigin(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">الوجهة</span>
            <Input value={destination} onChange={(event) => setDestination(event.target.value)} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">موعد الرحلة</span>
          <Input dir="ltr" type="datetime-local" value={departAt} onChange={(event) => setDepartAt(event.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">الحالة</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as Trip["status"])} className="select-field w-full">
            {(Object.keys(TRIP_STATUS_AR) as Trip["status"][]).map((value) => (
              <option key={value} value={value}>{TRIP_STATUS_AR[value]}</option>
            ))}
          </select>
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 border-t border-[#e4ecf2] pt-4">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>إلغاء</Button>
          <Button type="button" variant="success" onClick={() => void submit()} loading={saving}>{saving ? "جاري الحفظ…" : "حفظ التعديلات"}</Button>
        </div>
      </div>
    </Dialog>
  );
}
