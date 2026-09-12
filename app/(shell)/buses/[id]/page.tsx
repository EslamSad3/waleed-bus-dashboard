"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import {
  assignDriver,
  deleteBus,
  disableBus,
  fetchBus,
  fetchBusTripsPage,
  reactivateBus,
  unassignDriver,
  updateBus,
  type Bus,
  type TripRef,
} from "@/lib/actions/buses";
import { apiGet } from "@/lib/actions/http";
import type { DriverRow } from "@/lib/actions/members";
import { useFilterStore } from "@/stores/filters";

export default function BusDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const fleetId = useFilterStore((s) => s.fleetId);
  const [bus, setBus] = useState<Bus | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "trips">("overview");
  const [plate, setPlate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [driverId, setDriverId] = useState("");
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tripsFirst, setTripsFirst] = useState<{ key: string; items: TripRef[]; nextCursor: string | null } | null>(null);

  useEffect(() => {
    if (!fleetId) return;
    const key = `${fleetId}/${id}`;
    fetchBus(fleetId, id).then((r) => {
      if (r.ok) {
        setBus(r.data);
        setPlate(r.data.plateNumber ?? "");
        setCapacity(String(r.data.capacity));
        setFailed(null);
      } else setFailed(r.message);
      setLoadedKey(key);
    });
  }, [fleetId, id]);

  useEffect(() => {
    if (!fleetId) return;
    apiGet<{ items: DriverRow[] }>(`/api/fleet/drivers?limit=100`, fleetId).then((r) => {
      if (r.ok) setDrivers(r.data.items.filter((d) => d.status === "ACTIVE"));
    });
  }, [fleetId]);

  useEffect(() => {
    if (tab !== "trips" || !fleetId) return;
    const key = `${fleetId}/${id}`;
    fetchBusTripsPage(fleetId, id, null).then((r) => {
      if (r.ok) setTripsFirst({ key, items: r.data.items, nextCursor: r.data.nextCursor });
      else setError(r.message);
    });
  }, [tab, fleetId, id]);

  function note(ok: boolean, msg: string, updated?: Bus) {
    setError(ok ? null : msg);
    setStatus(ok ? msg : null);
    if (ok && updated) {
      setBus(updated);
      setPlate(updated.plateNumber ?? "");
      setCapacity(String(updated.capacity));
    }
  }

  async function save() {
    if (!fleetId) return;
    const r = await updateBus(fleetId, id, {
      plateNumber: plate || undefined,
      capacity: capacity === "" ? undefined : Number(capacity),
    });
    note(r.ok, r.ok ? "اتحفظ بنجاح" : r.message, r.ok ? r.data : undefined);
  }

  async function remove() {
    if (!fleetId) return;
    if (!window.confirm("تأكيد المسح — الإجراء ده مينفعش يتراجع. تمسح الأتوبيس؟")) return;
    const r = await deleteBus(fleetId, id);
    if (!r.ok) {
      note(false, r.message);
      return;
    }
    router.push("/buses");
    router.refresh();
  }

  async function disable() {
    if (!fleetId) return;
    const r = await disableBus(fleetId, id);
    note(r.ok, r.ok ? "اتوقف الأتوبيس" : r.message, r.ok ? r.data : undefined);
  }

  async function reactivate() {
    if (!fleetId) return;
    const r = await reactivateBus(fleetId, id);
    note(r.ok, r.ok ? "اشتغل الأتوبيس" : r.message, r.ok ? r.data : undefined);
  }

  async function assign() {
    if (!fleetId || !driverId) {
      setError("اختار السواق الأول");
      return;
    }
    const r = await assignDriver(fleetId, id, { driverUserId: driverId });
    note(r.ok, r.ok ? "اتعين السواق" : r.message);
    if (r.ok) setDriverId("");
  }

  async function unassign() {
    if (!fleetId) return;
    if (!window.confirm("تلغي تعيين السواق الحالي؟")) return;
    const r = await unassignDriver(fleetId, id);
    note(r.ok, r.ok ? "اتلغى التعيين" : r.message);
  }

  if (!fleetId) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="title-grad text-2xl font-extrabold">الأتوبيس</h1>
        <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-[#606060]">اختار الأسطول الأول (x-fleet-id)</p>
      </div>
    );
  }
  if (failed && loadedKey === `${fleetId}/${id}`) return <p role="alert" className="text-sm text-red-600">{failed}</p>;
  if (!bus || loadedKey !== `${fleetId}/${id}`) return <p className="text-sm text-[#606060]">جاري التحميل…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="title-grad text-2xl font-extrabold"><span dir="ltr">{bus.registrationNumber}</span></h1>
        <span className={bus.isActive ? "rounded-full bg-green-100 px-3 py-0.5 text-sm text-green-800" : "rounded-full bg-slate-200 px-3 py-0.5 text-sm text-slate-700"}>
          {bus.isActive ? "نشط" : "موقوف"}
        </span>
      </div>

      <nav aria-label="تبويبات الأتوبيس" className="flex gap-2">
        {(["overview", "trips"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t ? "page" : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${tab === t ? "bg-[#2f719e] text-white" : "bg-white text-[#1a1a1a] hover:bg-[#daeaf5]"}`}
          >
            {t === "overview" ? "نظرة عامة" : "رحلات الأتوبيس"}
          </button>
        ))}
      </nav>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {status && <p role="status" className="text-sm text-green-700">{status}</p>}

      {tab === "overview" && (
        <div className="grid max-w-3xl gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-3 font-bold">البيانات</h2>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">رقم اللوحة</span>
                <Input dir="ltr" value={plate} onChange={(e) => setPlate(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">السعة (1–300)</span>
                <Input dir="ltr" inputMode="numeric" type="number" min={1} max={300} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </label>
              <div className="flex gap-2">
                <Button type="button" onClick={save}>حفظ</Button>
                <Button type="button" variant="destructive" onClick={remove}>مسح</Button>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-3 font-bold">الحالة والسواق</h2>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={disable} disabled={!bus.isActive}>إيقاف</Button>
                <Button type="button" variant="secondary" onClick={reactivate} disabled={bus.isActive}>إعادة تشغيل</Button>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">تعيين سواق</span>
                <span className="flex gap-2">
                  <select
                    aria-label="اختار السواق"
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">اختار السواق</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.userId ?? d.id}>
                        {d.name ?? (d.userId ?? d.id).slice(0, 8)}{d.phone ? ` · ${d.phone}` : ""}
                      </option>
                    ))}
                  </select>
                  <Button type="button" onClick={assign}>تعيين</Button>
                </span>
              </label>
              <Button type="button" variant="secondary" onClick={unassign}>إلغاء التعيين</Button>
            </div>
          </div>
        </div>
      )}

      {tab === "trips" && (
        !tripsFirst || tripsFirst.key !== `${fleetId}/${id}` ? (
          <p className="text-sm text-[#606060]">جاري التحميل…</p>
        ) : (
          <CursorList<TripRef>
            key={`${fleetId}/${id}`}
            initialItems={tripsFirst.items}
            initialCursor={tripsFirst.nextCursor}
            loadMore={(cursor) =>
              fetchBusTripsPage(fleetId, id, cursor).then((r) => {
                if (!r.ok) throw new Error(r.message);
                return { items: r.data.items, nextCursor: r.data.nextCursor };
              })
            }
            keyOf={(t) => t.id}
            emptyMessage="لا توجد رحلات على الأتوبيس ده"
            renderItem={(t) => (
              <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow">
                <span className="font-semibold">{t.origin} ← {t.destination}</span>
                <span className="text-sm text-[#606060]">{t.status} · <time dateTime={t.departAt}>{new Date(t.departAt).toLocaleString("en-EG")}</time></span>
              </div>
            )}
          />
        )
      )}
    </div>
  );
}
