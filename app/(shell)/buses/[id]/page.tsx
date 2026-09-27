"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ui/image-picker";
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
import { useConfirm } from "@/components/ui/confirm-dialog";
import { fetchTripLines, type TripLine } from "@/lib/actions/trip-lines";
import { BUS_COLORS, busColorHex } from "@/lib/colors";
import { qk, patchDetail, useApiQuery, useQueryClient } from "@/lib/queries";
import { DetailPageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Trash2, UserPlus, Route as RouteIcon } from "lucide-react";
import { CreateTripDialog } from "@/components/trips/create-trip-dialog";

export default function BusDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fleetId?: string }>;
}) {
  const { id } = use(params);
  const { fleetId: scopeFleetId } = use(searchParams);
  const router = useRouter();
  const storeFleetId = useFilterStore((s) => s.fleetId);
  const setStoreFleetId = useFilterStore((s) => s.setFleetId);
  // الأسطول بيجي من اللينك نفسه (?fleetId=) أو من آخر نطاق مختار — من غير ما نطلب من المستخدم يختار.
  const fleetId = scopeFleetId || storeFleetId || null;
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [tab, setTab] = useState<"overview" | "trips">("overview");
  const [plate, setPlate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [color, setColor] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [brandId, setBrandId] = useState("");
  const [isAirConditioned, setIsAirConditioned] = useState(false);
  const [modelYear, setModelYear] = useState("");
  const [uploading, setUploading] = useState(false);
  const [driverId, setDriverId] = useState("");
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [driversLoaded, setDriversLoaded] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tripsFirst, setTripsFirst] = useState<{ key: string; items: TripRef[]; nextCursor: string | null } | null>(null);
  const [createTripOpen, setCreateTripOpen] = useState(false);
  const [tripsReloadKey, setTripsReloadKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [tripLineId, setTripLineId] = useState("");

  const { data: bus, isLoading: busLoading, error: busError } = useApiQuery<Bus>(
    qk.bus(fleetId ?? "unknown", id),
    () => fetchBus(fleetId!, id),
    { enabled: Boolean(fleetId) },
  );
  const { data: brands, isPending: brandsPending } = useApiQuery<VehicleBrand[]>(qk.brands, () => fetchBrands(true));
  const { data: tripLines, isPending: tripLinesPending } = useApiQuery<TripLine[]>(qk.tripLines, fetchTripLines);

  function syncForm(next: Bus) {
    setPlate(next.plateNumber ?? "");
    setCapacity(String(next.capacity));
    setColor(next.color ?? "");
    setImageUrl(next.imageUrl ?? "");
    setImageFile(null);
    setBrandId(next.brandId ?? "");
    setIsAirConditioned(next.isAirConditioned ?? false);
    setModelYear(next.modelYear ? String(next.modelYear) : "");
  }

  // Render-phase sync: fill the edit form from the cached bus (no setState-in-effect)
  const [formSource, setFormSource] = useState<Bus | null>(null);
  if (bus && (bus.id !== formSource?.id || bus.updatedAt !== formSource?.updatedAt)) {
    setFormSource(bus);
    syncForm(bus);
  }

  useEffect(() => {
    if (fleetId) setStoreFleetId(fleetId);
  }, [fleetId, setStoreFleetId]);

  useEffect(() => {
    if (!fleetId) return;
    apiGet<{ items: DriverRow[] }>(`/api/fleet/drivers?limit=100`, fleetId).then((r) => {
      if (r.ok) setDrivers(r.data.items.filter((d) => d.status === "ACTIVE"));
      setDriversLoaded(true);
    });
  }, [fleetId]);

  useEffect(() => {
    if (tab !== "trips" || !fleetId) return;
    const key = `${fleetId}/${id}`;
    fetchBusTripsPage(fleetId, id, null).then((r) => {
      if (r.ok) setTripsFirst({ key, items: r.data.items, nextCursor: r.data.nextCursor });
      else setError(r.message);
    });
  }, [tab, fleetId, id, tripsReloadKey]);

  async function onImageFile(file: File | null) {
    if (!file || !fleetId) return;
    setUploading(true);
    const uploaded = await uploadBusImage(fleetId, file);
    setUploading(false);
    if (!uploaded.ok) {
      setError(uploaded.message);
      return;
    }
    setImageFile(file);
    setImageUrl(uploaded.data.url);
  }

  function note(ok: boolean, msg: string, updated?: Bus) {
    setError(ok ? null : msg);
    setStatus(ok ? msg : null);
    if (ok && updated) {
      patchDetail(queryClient, qk.bus(fleetId ?? "unknown", id), updated);
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
    if (
      !(await confirm({
        title: "تأكيد المسح",
        description: "الإجراء ده مينفعش يتراجع — تمسح العربية؟",
        confirmLabel: "مسح",
        destructive: true,
      }))
    ) {
      return;
    }
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
    note(r.ok, r.ok ? "اتوقفت العربية" : r.message, r.ok ? r.data : undefined);
  }

  async function reactivate() {
    if (!fleetId) return;
    const r = await reactivateBus(fleetId, id);
    note(r.ok, r.ok ? "اشتغلت العربية" : r.message, r.ok ? r.data : undefined);
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
    if (
      !(await confirm({
        title: "تأكيد إلغاء التعيين",
        description: "هتلغي تعيين السواق الحالي من العربية؟",
        confirmLabel: "إلغاء التعيين",
        destructive: true,
      }))
    ) {
      return;
    }
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
    patchDetail(queryClient, qk.bus(fleetId, id), r.data);
    setLineOpen(false); setTripLineId(""); setStatus("اتعيّن خط الرحلة للعربية");
  }
  async function clearLine() {
    if (!fleetId) return;
    const r = await unassignTripLine(fleetId, id);
    if (!r.ok) { setError(r.message); return; }
    if (bus) patchDetail(queryClient, qk.bus(fleetId, id), { ...bus, lineId: null, line: null });
    setStatus("اتشال خط الرحلة من العربية");
  }

  if (!fleetId) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="title-grad text-2xl font-extrabold">العربية</h1>
        <p className="empty-state">مفيش أسطول محدد لعرض العربية — ارجع لقايمة العربيات وافتحها من هناك.</p>
      </div>
    );
  }
  if (busError) return <p role="alert" className="text-sm text-red-600">{busError.message}</p>;
  if (!bus || busLoading) return <p className="text-sm text-[#606060]">جاري التحميل…</p>;

  const currentDriver = drivers.find((driver) => driver.assignments?.some((assignment) => assignment.busId === id && assignment.status === "ACTIVE"));
  // A driver has one active bus at a time. The API ends that assignment and
  // moves the driver when another bus is selected, so do not hide drivers
  // already operating a different bus.
  const eligibleDrivers = drivers;
  const colorPresets = BUS_COLORS;
  const storedColorHex = busColorHex(color);
  const colorMissing = color && !colorPresets.some((preset) => preset.name === color);

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div><h1 className="page-title"><span dir="ltr">{bus.registrationNumber}</span></h1><p className="page-description">بيانات العربية والحالة والسواق المعيّن وسجل الرحلات.</p></div>
        <div className="flex items-center gap-3">
          <span className={bus.isActive ? "rounded-full bg-green-100 px-3 py-0.5 text-sm text-green-800" : "rounded-full bg-slate-200 px-3 py-0.5 text-sm text-slate-700"}>
            {bus.isActive ? "نشط" : "موقوف"}
          </span>
          <AsyncButton type="button" variant="destructive" onClick={remove}><Trash2 className="size-4" /> مسح العربية</AsyncButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="تبويبات العربية" className="flex gap-2 overflow-x-auto pb-1">
        {(["overview", "trips"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t ? "page" : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${tab === t ? "bg-[#059ff8] text-white" : "bg-white text-[#1a1a1a] hover:bg-[#d6eeff]"}`}
          >
            {t === "overview" ? "نظرة عامة" : "رحلات العربية"}
          </button>
        ))}
      </nav>
        <Button type="button" onClick={() => setCreateTripOpen(true)}>
          <RouteIcon className="size-4" aria-hidden="true" /> رحلة جديدة
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {status && <p role="status" className="text-sm text-green-700">{status}</p>}

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panel-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="section-title">البيانات</h2>
                {bus.imageUrl ? <img src={bus.imageUrl} alt={`صورة العربية ${bus.registrationNumber}`} className="mb-3 h-32 w-full rounded-xl object-cover" /> : null}
                <dl className="space-y-2 text-sm">
                  <div className="flex gap-3"><dt className="text-[#687886]">رقم اللوحة</dt><dd dir="ltr" className="font-semibold">{bus.plateNumber ?? "—"}</dd></div>
                  <div className="flex items-center gap-3"><dt className="text-[#687886]">اللون</dt><dd className="flex items-center gap-2 font-semibold">{bus.color ? <span className="inline-block size-4 rounded-full border border-[#d8e4ec]" style={{ backgroundColor: busColorHex(bus.color) ?? "#e5e7eb" }} /> : null}{bus.color ?? "—"}</dd></div>
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
                <AsyncButton type="button" variant="secondary" onClick={disable} disabled={!bus.isActive}>إيقاف</AsyncButton>
                <AsyncButton type="button" variant="secondary" onClick={reactivate} disabled={bus.isActive}>إعادة تشغيل</AsyncButton>
              </div>
              <Button type="button" onClick={() => setAssignOpen(true)}>
                <UserPlus className="size-4" aria-hidden="true" /> تعيين سواق
              </Button>
              <AsyncButton type="button" variant="secondary" onClick={unassign} disabled={!currentDriver}>إلغاء التعيين</AsyncButton>
              <Button type="button" variant="secondary" onClick={() => setLineOpen(true)}>تعيين خط رحلة</Button>
              <AsyncButton type="button" variant="secondary" onClick={clearLine} disabled={!bus.lineId}>إلغاء خط الرحلة</AsyncButton>
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
            emptyMessage="لا توجد رحلات على العربية دي"
            renderItem={(t) => (
              <div className="list-card">
                <span className="font-semibold">{t.origin} ← {t.destination}</span>
                <span className="text-sm text-[#606060]">{t.status} · <time dateTime={t.departAt}>{new Date(t.departAt).toLocaleString("en-EG")}</time></span>
              </div>
            )}
          />
        )
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="تعديل العربية" description={`تحديث بيانات ${bus.registrationNumber}.`} size="sm">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">رقم اللوحة</span>
            <Input dir="ltr" value={plate} onChange={(e) => setPlate(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">اللون</span>
            <select value={color} onChange={(e) => setColor(e.target.value)} className="select-field w-full">
              <option value="">اختار اللون…</option>
              {colorPresets.map((preset) => (
                <option key={preset.name} value={preset.name}>{preset.name}</option>
              ))}
              {colorMissing ? <option value={color}>{color}</option> : null}
            </select>
          </label>
          {color ? (
            <div className="flex items-center gap-2 text-sm text-[#5e6b78]">
              <span className="inline-block size-6 rounded-full border border-[#d8e4ec]" style={{ backgroundColor: storedColorHex ?? "transparent" }} />
              {color}
            </div>
          ) : null}
          <ImagePicker
            label="صورة العربية"
            file={imageFile}
            onChange={(file) => void onImageFile(file)}
            existingUrl={imageUrl}
            uploading={uploading}
            hint="الصورة بتترفع كملف (FormData) للتخزين السحابي تلقائيًا."
          />
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">الماركة</span>
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="select-field w-full">
              <option value="">بدون ماركة…</option>
              {(brands ?? []).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}{brand.isActive ? "" : " (موقوفة)"}</option>)}
              {bus?.brand && !(brands ?? []).some((b) => b.id === bus.brand!.id) ? (
                <option key={bus.brand.id} value={bus.brand.id}>{bus.brand.name} (موقوفة)</option>
              ) : null}
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
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="danger" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <AsyncButton type="button" variant="success" onClick={save}>حفظ التعديلات</AsyncButton>
          </div>
        </div>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen} title="تعيين سواق" description="اختار السواق لتشغيل العربية. لو هو معيّن على عربية أخرى، هيتنقل هنا تلقائيًا." size="sm">
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
            <Button type="button" variant="danger" onClick={() => setAssignOpen(false)}>إلغاء</Button>
            <AsyncButton type="button" variant="success" onClick={assign} disabled={!driverId}>تأكيد التعيين</AsyncButton>
          </div>
        </div>
      </Dialog>
      <CreateTripDialog
        open={createTripOpen}
        lockedFleetId={fleetId ?? undefined}
        lockedBusId={id}
        onCreated={() => {
          setTripsReloadKey((key) => key + 1);
          setStatus("اتضافت الرحلة على العربية دي بنجاح");
        }}
        onClose={() => setCreateTripOpen(false)}
      />
      <Dialog open={lineOpen} onOpenChange={setLineOpen} title="تعيين خط رحلة" description="الخطوط من الكتالوج المركزي ومتاحة لكل الأساطيل." size="sm">
        <div className="space-y-4"><select value={tripLineId} onChange={(e) => setTripLineId(e.target.value)} className="select-field w-full"><option value="">اختار خط الرحلة</option>{(tripLines ?? []).filter((line) => line.isActive).map((line) => <option key={line.id} value={line.id}>{line.name} · {line.origin} ← {line.destination}</option>)}</select>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="danger" onClick={() => setLineOpen(false)}>إلغاء</Button><AsyncButton type="button" variant="success" onClick={assignLine}>تأكيد التعيين</AsyncButton></div></div>
      </Dialog>
    </div>
  );
}
