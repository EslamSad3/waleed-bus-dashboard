"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteTrip, fetchTrip, updateTrip, TRIP_STATUS_AR, type Trip } from "@/lib/actions/trips";
import { useFilterStore } from "@/stores/filters";

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const fleetId = useFilterStore((s) => s.fleetId);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departAt, setDepartAt] = useState("");
  const [status, setStatus] = useState<Trip["status"]>("SCHEDULED");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fleetId) return;
    const key = `${fleetId}/${id}`;
    fetchTrip(fleetId, id).then((r) => {
      if (r.ok) {
        setTrip(r.data);
        setOrigin(r.data.origin);
        setDestination(r.data.destination);
        setDepartAt(r.data.departAt.slice(0, 16));
        setStatus(r.data.status);
        setFailed(null);
      } else setFailed(r.message);
      setLoadedKey(key);
    });
  }, [fleetId, id]);

  function done(ok: boolean, msg: string, updated?: Trip) {
    setError(ok ? null : msg);
    setNote(ok ? msg : null);
    if (ok && updated) setTrip(updated);
  }

  async function save() {
    if (!fleetId) return;
    const iso = departAt ? new Date(departAt).toISOString() : undefined;
    const r = await updateTrip(fleetId, id, { origin, destination, departAt: iso });
    done(r.ok, r.ok ? "اتحفظ بنجاح" : r.message, r.ok ? r.data : undefined);
  }

  async function move(next: Trip["status"]) {
    if (!fleetId) return;
    const r = await updateTrip(fleetId, id, { status: next });
    if (r.ok) setStatus(r.data.status);
    done(r.ok, r.ok ? "اتحفظ بنجاح" : r.message, r.ok ? r.data : undefined);
  }

  async function cancel() {
    if (!window.confirm("تلغي الرحلة دي؟")) return;
    await move("CANCELLED");
  }

  async function remove() {
    if (!fleetId) return;
    if (!window.confirm("تأكيد المسح — الإجراء ده مينفعش يتراجع. تمسح الرحلة؟")) return;
    const r = await deleteTrip(fleetId, id);
    if (!r.ok) {
      done(false, r.message);
      return;
    }
    router.push("/trips");
    router.refresh();
  }

  if (!fleetId) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="title-grad text-2xl font-extrabold">الرحلة</h1>
        <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-[#606060]">اختار الأسطول الأول (x-fleet-id)</p>
      </div>
    );
  }
  if (failed && loadedKey === `${fleetId}/${id}`) return <p role="alert" className="text-sm text-red-600">{failed}</p>;
  if (!trip || loadedKey !== `${fleetId}/${id}`) return <p className="text-sm text-[#606060]">جاري التحميل…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="title-grad text-2xl font-extrabold">{trip.origin} ← {trip.destination}</h1>
        <span className="rounded-full bg-[#daeaf5] px-3 py-0.5 text-sm text-[#2f719e]">{TRIP_STATUS_AR[trip.status]}</span>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {note && <p role="status" className="text-sm text-green-700">{note}</p>}

      <div className="grid max-w-3xl gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-3 font-bold">الخط والميعاد</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">من</span>
                <Input value={origin} onChange={(e) => setOrigin(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">إلى</span>
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">ميعاد المغادرة</span>
              <Input dir="ltr" type="datetime-local" value={departAt} onChange={(e) => setDepartAt(e.target.value)} />
            </label>
            <p className="text-sm text-[#606060]">الأتوبيس: <span dir="ltr">{trip.busId}</span></p>
            <div className="flex gap-2">
              <Button type="button" onClick={save}>حفظ</Button>
              <Button type="button" variant="destructive" onClick={remove}>مسح</Button>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-3 font-bold">الحالة</h2>
          <div className="flex flex-wrap gap-2">
            {(["SCHEDULED", "DEPARTED", "COMPLETED"] as const).map((s) => (
              <Button
                key={s}
                type="button"
                variant={status === s ? "default" : "secondary"}
                onClick={() => move(s)}
                disabled={status === s}
              >
                {TRIP_STATUS_AR[s]}
              </Button>
            ))}
            <Button type="button" variant="destructive" onClick={cancel} disabled={status === "CANCELLED"}>
              إلغاء الرحلة
            </Button>
          </div>
          <Button asChild variant="secondary" className="mt-4">
            <Link href="/bookings">كشف الحجوزات</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
