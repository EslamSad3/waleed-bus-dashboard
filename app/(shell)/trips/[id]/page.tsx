"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteTrip, findTripAcrossFleets, updateTrip, TRIP_STATUS_AR, type Trip } from "@/lib/actions/trips";
import { assignDriver, fetchBus, type Bus } from "@/lib/actions/buses";
import { apiGet } from "@/lib/actions/http";
import type { DriverRow } from "@/lib/actions/members";

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [fleetId, setFleetId] = useState<string | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departAt, setDepartAt] = useState("");
  const [status, setStatus] = useState<Trip["status"]>("SCHEDULED");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bus, setBus] = useState<Bus | null>(null);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [driverId, setDriverId] = useState("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    findTripAcrossFleets(id).then((r) => {
      if (r.ok) {
        setFleetId(r.data.fleetId);
        setTrip(r.data.trip);
        setOrigin(r.data.trip.origin);
        setDestination(r.data.trip.destination);
        setDepartAt(r.data.trip.departAt.slice(0, 16));
        setStatus(r.data.trip.status);
        setFailed(null);
      } else setFailed(r.message);
      setLoadedKey(id);
    });
  }, [id]);

  useEffect(() => {
    if (!fleetId || !trip) return;
    fetchBus(fleetId, trip.busId).then((result) => {
      if (result.ok) setBus(result.data);
    });
    apiGet<{ items: DriverRow[] }>("/api/fleet/drivers?limit=100", fleetId).then((result) => {
      if (result.ok) setDrivers(result.data.items.filter((driver) => driver.status === "ACTIVE"));
    });
  }, [fleetId, trip]);

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

  async function assignTripDriver() {
    if (!fleetId || !trip || !driverId) {
      setError("اختار السواق الأول");
      return;
    }
    setAssigning(true);
    const result = await assignDriver(fleetId, trip.busId, { driverUserId: driverId });
    setAssigning(false);
    done(result.ok, result.ok ? "اتعين السواق على أتوبيس الرحلة" : result.message);
    if (result.ok) {
      const refreshed = await apiGet<{ items: DriverRow[] }>("/api/fleet/drivers?limit=100", fleetId);
      if (refreshed.ok) setDrivers(refreshed.data.items.filter((driver) => driver.status === "ACTIVE"));
    }
  }

  if (failed && loadedKey === id) return <p role="alert" className="text-sm text-red-600">{failed}</p>;
  if (!trip || loadedKey !== id || !fleetId) return <p className="text-sm text-[#606060]">جاري التحميل…</p>;

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div><h1 className="page-title">{trip.origin} ← {trip.destination}</h1><p className="page-description">تفاصيل الخط والميعاد وحالة الرحلة.</p></div>
        <span className={trip.status === "CANCELLED" ? "status-pill status-pill-muted" : "status-pill"}>{TRIP_STATUS_AR[trip.status]}</span>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {note && <p role="status" className="text-sm text-green-700">{note}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel-card p-5 sm:p-6">
          <h2 className="section-title">الخط والميعاد</h2>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="rounded-xl bg-[#f8fbfd] p-3 text-sm">
              <span className="block text-[#606060]">أتوبيس الرحلة</span>
              <strong>{bus?.registrationNumber ?? "جاري تحميل بيانات الأتوبيس…"}</strong>
              {bus?.plateNumber ? <span className="mr-2 text-[#606060]" dir="ltr">{bus.plateNumber}</span> : null}
              <span className="mr-2 text-[#606060]">· السعة {bus?.capacity ?? "—"}</span>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium">تعيين سواق من نفس الأسطول</span>
                <select aria-label="تعيين سواق الرحلة" value={driverId} onChange={(event) => setDriverId(event.target.value)} className="select-field w-full" disabled={!bus || assigning}>
                  <option value="">اختار السواق</option>
                  {drivers.map((driver) => <option key={driver.userId ?? driver.id} value={driver.userId ?? driver.id}>{driver.name || driver.nickname || driver.phoneNumber || "سواق بدون اسم"}</option>)}
                </select>
              </label>
              <Button type="button" className="mt-2" onClick={() => void assignTripDriver()} disabled={!driverId || assigning}>{assigning ? "جاري التعيين…" : "تعيين السواق"}</Button>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={save}>حفظ</Button>
              <Button type="button" variant="destructive" onClick={remove}>مسح</Button>
            </div>
          </div>
        </div>
        <div className="panel-card p-5 sm:p-6">
          <h2 className="section-title">الحالة</h2>
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
            <Link href={`/bookings?tripId=${encodeURIComponent(trip.id)}`}>كشف حجوزات الرحلة</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
