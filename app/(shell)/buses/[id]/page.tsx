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
  fetchBrands,
  fetchBus,
  fetchBusTripsPage,
  reactivateBus,
  unassignDriver,
  assignTripLine,
  unassignTripLine,
  updateBus,
  uploadBusImage,
  type Bus,
  type TripRef,
  type VehicleBrand,
} from "@/lib/actions/buses";
import { apiGet } from "@/lib/actions/http";
import type { DriverRow } from "@/lib/actions/members";
import { useFilterStore } from "@/stores/filters";
import { Dialog } from "@/components/ui/dialog";
import { fetchTripLines, type TripLine } from "@/lib/actions/trip-lines";
import { Pencil, UserPlus } from "lucide-react";

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
  const [color, setColor] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [brandId, setBrandId] = useState("");
  const [isAirConditioned, setIsAirConditioned] = useState(false);
  const [modelYear, setModelYear] = useState("");
  const [brands, setBrands] = useState<VehicleBrand[]>([]);
  const [uploading, setUploading] = useState(false);

  async function onImageFile(file: File | null) {
    if (!file || !fleetId) return;
    setUploading(true);
    const uploaded = await uploadBusImage(fleetId, file);
    setUploading(false);
    if (!uploaded.ok) {
      setError(uploaded.message);
      return;
    }
    setImageUrl(uploaded.data.url);
  }
  const [driverId, setDriverId] = useState("");
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tripsFirst, setTripsFirst] = useState<{ key: string; items: TripRef[]; nextCursor: string | null } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [tripLines, setTripLines] = useState<TripLine[]>([]);
  const [tripLineId, setTripLineId] = useState("");

  function syncForm(bus: Bus) {
    setPlate(bus.plateNumber ?? "");
    setCapacity(String(bus.capacity));
    setColor(bus.color ?? "");
    setImageUrl(bus.imageUrl ?? "");
    setBrandId(bus.brandId ?? "");
    setIsAirConditioned(bus.isAirConditioned ?? false);
    setModelYear(bus.modelYear ? String(bus.modelYear) : "");
  }

  useEffect(() => {
    if (!fleetId) return;
    const key = `${fleetId}/${id}`;
    fetchBus(fleetId, id).then((r) => {
      if (r.ok) {
        setBus(r.data);
        syncForm(r.data);
        setFailed(null);
      } else setFailed(r.message);
      setLoadedKey(key);
    });
  }, [fleetId, id]);

  useEffect(() => {
    fetchBrands().then((r) => {
      if (r.ok) setBrands(r.data);
    });
  }, []);

  useEffect(() => {
    if (!fleetId) return;
    apiGet<{ items: DriverRow[] }>(`/api/fleet/drivers?limit=100`, fleetId).then((r) => {
      if (r.ok) setDrivers(r.data.items.filter((d) => d.status === "ACTIVE"));
    });
  }, [fleetId]);

  useEffect(() => { fetchTripLines().then((r) => { if (r.ok) setTripLines(r.data.filter((line) => line.isActive)); }); }, []);

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
      syncForm(updated);
    }
  }

  async function save() {
    if (!fleetId) return;
    const r = await updateBus(fleetId, id, {
      plateNumber: plate || undefined,
      color: color || undefined,
      imageUrl: imageUrl || undefined,
      brandId: brandId || null,
      isAirConditioned,
      modelYear: modelYear === "" ? undefined : Number(modelYear),
      capacity: capacity === "" ? undefined : Number(capacity),
    });
    note(r.ok, r.ok ? "اتحفظ بنجاح" : r.message, r.ok ? r.data : undefined);
    if (r.ok) setEditOpen(false);
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
    if (r.ok) {
      setAssignOpen(false);
      setDriverId("");
      const refreshed = await apiGet<{ items: DriverRow[] }>(`/api/fleet/drivers?limit=100`, fleetId);
      if (refreshed.ok) setDrivers(refreshed.data.items.filter((driver) => driver.status === "ACTIVE"));
    }
  }

  async function unassign() {
    if (!fleetId) return;
    if (!window.confirm("تلغي تعيين السواق الحالي؟")) return;
    const r = await unassignDriver(fleetId, id);
    note(r.ok, r.ok ? "اتلغى التعيين" : r.message);
    if (r.ok) {
      const refreshed = await apiGet<{ items: DriverRow[] }>(`/api/fleet/drivers?limit=100`, fleetId);
      if (refreshed.ok) setDrivers(refreshed.data.items.filter((driver) => driver.status === "ACTIVE"));
    }
  }

  async function assignLine() {
    if (!fleetId || !tripLineId) { setError("اختار خط الرحلة الأول"); return; }
    const r = await assignTripLine(fleetId, id, tripLineId);
    if (!r.ok) { setError(r.message); return; }
    setBus(r.data); setLineOpen(false); setTripLineId(""); setStatus("اتعيّن خط الرحلة للأتوبيس");
  }
  async function clearLine() {
    if (!fleetId) return;
    const r = await unassignTripLine(fleetId, id);
    if (!r.ok) { setError(r.message); return; }
    setBus((current) => current ? { ...current, lineId: null, line: null } : current); setStatus("اتشال خط الرحلة من الأتوبيس");
  }

  if (!fleetId) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="title-grad text-2xl font-extrabold">الأتوبيس</h1>
        <p className="empty-state">اختار الأسطول الأول لعرض بيانات الأتوبيس.</p>
      </div>
    );
  }
  if (failed && loadedKey === `${fleetId}/${id}`) return <p role="alert" className="text-sm text-red-600">{failed}</p>;
  if (!bus || loadedKey !== `${fleetId}/${id}`) return <p className="text-sm text-[#606060]">جاري التحميل…</p>;

  const currentDriver = drivers.find((driver) => driver.assignments?.some((assignment) => assignment.busId === id && assignment.status === "ACTIVE"));
  // A driver has one active bus at a time. The API ends that assignment and
  // moves the driver when another bus is selected, so do not hide drivers
  // already operating a different bus.
  const eligibleDrivers = drivers;

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div><h1 className="page-title"><span dir="ltr">{bus.registrationNumber}</span></h1><p className="page-description">بيانات الأتوبيس والحالة والسواق المعيّن وسجل الرحلات.</p></div>
        <span className={bus.isActive ? "rounded-full bg-green-100 px-3 py-0.5 text-sm text-green-800" : "rounded-full bg-slate-200 px-3 py-0.5 text-sm text-slate-700"}>
          {bus.isActive ? "نشط" : "موقوف"}
        </span>
      </div>

      <nav aria-label="تبويبات الأتوبيس" className="flex gap-2 overflow-x-auto pb-1">
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
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panel-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="section-title">البيانات</h2>
                {bus.imageUrl ? <img src={bus.imageUrl} alt={`صورة الأتوبيس ${bus.registrationNumber}`} className="mb-3 h-32 w-full rounded-xl object-cover" /> : null}
                <dl className="space-y-2 text-sm">
                  <div className="flex gap-3"><dt className="text-[#687886]">رقم اللوحة</dt><dd dir="ltr" className="font-semibold">{bus.plateNumber ?? "—"}</dd></div>
                  <div className="flex gap-3"><dt className="text-[#687886]">اللون</dt><dd className="font-semibold">{bus.color ?? "—"}</dd></div>
                  <div className="flex gap-3"><dt className="text-[#687886]">الماركة</dt><dd className="font-semibold">{bus.brand?.name ?? "—"}</dd></div>
                  <div className="flex gap-3"><dt className="text-[#687886]">مكيّف</dt><dd className="font-semibold">{bus.isAirConditioned == null ? "—" : bus.isAirConditioned ? "نعم" : "لا"}</dd></div>
                  <div className="flex gap-3"><dt className="text-[#687886]">سنة الموديل</dt><dd className="font-semibold">{bus.modelYear ?? "—"}</dd></div>
                  <div className="flex gap-3"><dt className="text-[#687886]">السعة</dt><dd className="font-semibold">{bus.capacity} مقعد</dd></div>
                </dl>
              </div>
              <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" aria-hidden="true" /> تعديل
              </Button>
            </div>
          </div>
          <div className="panel-card p-5 sm:p-6">
            <h2 className="section-title">الحالة والسواق</h2>
            <div className="flex flex-col gap-3">
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm">
                <span className="block text-[#606060]">السواق الحالي</span>
                <strong>{currentDriver?.name ?? "لا يوجد سواق معين"}</strong>
                {currentDriver?.phoneNumber ? <span className="mr-2 text-[#606060]" dir="ltr">{currentDriver.phoneNumber}</span> : null}
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm">
                <span className="block text-[#606060]">خط الرحلة الحالي</span>
                <strong>{bus.line ? bus.line.name : "لا يوجد خط معيّن"}</strong>
                {bus.line ? <span dir="ltr" className="mr-2 text-[#606060]">{bus.line.code}</span> : null}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={disable} disabled={!bus.isActive}>إيقاف</Button>
                <Button type="button" variant="secondary" onClick={reactivate} disabled={bus.isActive}>إعادة تشغيل</Button>
              </div>
              <Button type="button" onClick={() => setAssignOpen(true)}>
                <UserPlus className="size-4" aria-hidden="true" /> تعيين سواق
              </Button>
              <Button type="button" variant="secondary" onClick={unassign} disabled={!currentDriver}>إلغاء التعيين</Button>
              <Button type="button" variant="secondary" onClick={() => setLineOpen(true)}>تعيين خط رحلة</Button>
              <Button type="button" variant="secondary" onClick={clearLine} disabled={!bus.lineId}>إلغاء خط الرحلة</Button>
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
              <div className="list-card">
                <span className="font-semibold">{t.origin} ← {t.destination}</span>
                <span className="text-sm text-[#606060]">{t.status} · <time dateTime={t.departAt}>{new Date(t.departAt).toLocaleString("en-EG")}</time></span>
              </div>
            )}
          />
        )
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="تعديل الأتوبيس" description={`تحديث بيانات ${bus.registrationNumber}.`} size="sm">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">رقم اللوحة</span>
            <Input dir="ltr" value={plate} onChange={(e) => setPlate(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">اللون</span>
            <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="أبيض" />
          </label>
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">صورة الأتوبيس</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => void onImageFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:ml-3 file:rounded-lg file:border-0 file:bg-[#2f719e] file:px-4 file:py-2 file:text-white"
            />
            {uploading ? <span className="mt-1 block text-xs text-slate-500">جاري رفع الصورة وضغطها…</span> : null}
            <Input dir="ltr" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
          </label>
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">الماركة</span>
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="select-field w-full">
              <option value="">بدون ماركة…</option>
              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-2 block font-bold text-[#334454]">سنة الموديل</span>
              <Input dir="ltr" inputMode="numeric" type="number" min={1980} max={2100} value={modelYear} onChange={(e) => setModelYear(e.target.value)} placeholder="2022" />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block font-bold text-[#334454]">السعة (1–300)</span>
              <Input dir="ltr" inputMode="numeric" type="number" min={1} max={300} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </label>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={isAirConditioned} onChange={(e) => setIsAirConditioned(e.target.checked)} className="size-4" />
            مكيّف
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-between">
            <Button type="button" variant="destructive" onClick={remove}>مسح الأتوبيس</Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>إلغاء</Button>
              <Button type="button" onClick={save}>حفظ التعديلات</Button>
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen} title="تعيين سواق" description="اختار السواق لتشغيل الأتوبيس. لو هو معيّن على أتوبيس آخر، هيتنقل هنا تلقائيًا." size="sm">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">السواق</span>
            <select aria-label="اختار السواق" value={driverId} onChange={(e) => setDriverId(e.target.value)} className="select-field w-full">
              <option value="">اختار السواق</option>
              {eligibleDrivers.map((d) => {
                const assignment = d.assignments?.find((item) => item.status === "ACTIVE");
                const assignedElsewhere = assignment && assignment.busId !== id;
                return (
                  <option key={d.id} value={d.userId ?? d.id}>
                    {d.name ?? (d.userId ?? d.id).slice(0, 8)}{d.phoneNumber ? ` · ${d.phoneNumber}` : ""}{assignedElsewhere ? ` · معيّن حاليًا على ${assignment.registrationNumber}` : ""}
                  </option>
                );
              })}
            </select>
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {eligibleDrivers.length === 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">لا يوجد سواقون نشطون في هذا الأسطول بعد. أضف سواقًا من صفحة السواقين أولًا.</p>}
          <div className="flex justify-end gap-2 border-t border-[#e4ecf2] pt-4">
            <Button type="button" variant="secondary" onClick={() => setAssignOpen(false)}>إلغاء</Button>
            <Button type="button" onClick={assign} disabled={!driverId}>تأكيد التعيين</Button>
          </div>
        </div>
      </Dialog>
      <Dialog open={lineOpen} onOpenChange={setLineOpen} title="تعيين خط رحلة" description="الخطوط من الكتالوج المركزي ومتاحة لكل الأساطيل." size="sm">
        <div className="space-y-4"><select value={tripLineId} onChange={(e) => setTripLineId(e.target.value)} className="select-field w-full"><option value="">اختار خط الرحلة</option>{tripLines.map((line) => <option key={line.id} value={line.id}>{line.name} · {line.origin} ← {line.destination}</option>)}</select>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-2 border-t pt-4"><Button variant="secondary" onClick={() => setLineOpen(false)}>إلغاء</Button><Button onClick={assignLine}>تأكيد التعيين</Button></div></div>
      </Dialog>
    </div>
  );
}
