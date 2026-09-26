"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ui/image-picker";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import {
  createBus,
  fetchBusesPage,
  fetchBrands,
  uploadBusImage,
  type Bus,
  type VehicleBrand,
} from "@/lib/actions/buses";
import { fetchFleetsPage, type Fleet } from "@/lib/actions/fleets";
import type { CursorPage } from "@/lib/actions/http";
import { createBusSchema } from "@/lib/schemas/p1";
import { BUS_COLORS } from "@/lib/colors";
import { qk, upsertInCursorList, useApiQuery, useDataQuery, useQueryClient } from "@/lib/queries";
import { useFilterStore } from "@/stores/filters";
import { FleetPicker } from "@/components/fleet-picker";
import { setFleetScopeCookie } from "@/lib/fleet-scope-cookie";

type BusRow = Bus & { fleetName: string };
type FleetCursor = { fleetId: string; fleetName: string; cursor: string | null };
type BusAggregatePage = { items: BusRow[]; nextCursor: string | null };

type CreateValues = z.input<typeof createBusSchema>;

async function fetchAllFleetStates(): Promise<FleetCursor[]> {
  const fleets: FleetCursor[] = [];
  let cursor: string | null = null;
  do {
    const result = await fetchFleetsPage(cursor);
    if (!result.ok) throw new Error(result.message);
    fleets.push(...result.data.items.map((fleet) => ({ fleetId: fleet.id, fleetName: fleet.name, cursor: null })));
    cursor = result.data.nextCursor;
  } while (cursor);
  return fleets;
}

async function fetchAggregateBusPage(cursorState: string | null): Promise<BusAggregatePage> {
  const states: FleetCursor[] = cursorState ? JSON.parse(cursorState) as FleetCursor[] : await fetchAllFleetStates();
  const results = await Promise.all(
    states.map(async (state) => {
      const result = await fetchBusesPage(state.fleetId, state.cursor);
      if (!result.ok) throw new Error(result.message);
      return { state, page: result.data };
    }),
  );
  const nextStates = results.map(({ state, page }) => ({ ...state, cursor: page.nextCursor }));
  const items = results.flatMap(({ state, page }) => page.items.map((bus) => ({ ...bus, fleetName: state.fleetName })));
  return {
    items,
    nextCursor: nextStates.some((state) => state.cursor) ? JSON.stringify(nextStates) : null,
  };
}

/** نافذة إضافة عربية — من غير رقم تسجيل (بيتولد تلقائيًا) واللون قايمة بمعاينة. */
function CreateBusDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { fleetId: scopedFleetId, setFleetId } = useFilterStore();
  const [fleetId, setLocalFleetId] = useState(scopedFleetId ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: brands } = useApiQuery<VehicleBrand[]>(qk.brands, () => fetchBrands(true), { enabled: open });
  const { data: fleetsPage } = useApiQuery<CursorPage<Fleet>>(qk.fleets, () => fetchFleetsPage(null), { enabled: open });
  const fleetName = useMemo(
    () => (fleetsPage?.items ?? []).find((fleet) => fleet.id === fleetId)?.name ?? "—",
    [fleetsPage, fleetId],
  );

  const form = useForm<CreateValues>({
    resolver: zodResolver(createBusSchema),
    defaultValues: {
      registrationNumber: undefined,
      plateNumber: "",
      color: "",
      imageUrl: "",
      brandId: null,
      isAirConditioned: false,
      modelYear: undefined as unknown as number,
      capacity: undefined as unknown as number,
    },
  });

  function resetForm() {
    setImageFile(null);
    setFormError(null);
    form.reset();
  }

  async function onFileSelect(file: File | null) {
    setImageFile(file);
    setFormError(null);
    if (!file) return;
    if (!fleetId) {
      setFormError("اختار الأسطول الأول قبل رفع الصورة.");
      return;
    }
    setUploading(true);
    const uploaded = await uploadBusImage(fleetId, file);
    setUploading(false);
    if (!uploaded.ok) {
      setFormError(uploaded.message);
      return;
    }
    form.setValue("imageUrl", uploaded.data.url, { shouldValidate: true });
  }

  async function onSubmit(values: CreateValues) {
    setFormError(null);
    if (!fleetId) {
      setFormError("اختار الأسطول الأول قبل إضافة العربية.");
      return;
    }
    setFleetId(fleetId);
    setFleetScopeCookie(fleetId);
    const r = await createBus(fleetId, {
      ...values,
      registrationNumber: values.registrationNumber || undefined,
      brandId: values.brandId || null,
      modelYear: values.modelYear ?? undefined,
    });
    if (!r.ok) {
      setFormError(r.message);
      return;
    }
    // تحديث فوري للجدول من غير إعادة تحميل
    upsertInCursorList<BusRow>(queryClient, qk.busesAggregate, { ...r.data, fleetName });
    resetForm();
    onClose();
  }

  const color = form.watch("color");

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title="عربية جديدة" description="سجّل العربية داخل أسطولها: اللوحة واللون والصورة مطلوبين — رقم التسجيل بيتولد تلقائيًا." size="sm">
      <div>
        <div className="mb-4">
          <FleetPicker value={fleetId} onChange={setLocalFleetId} />
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">رقم اللوحة</span>
            <Input dir="ltr" placeholder="أ ب ج 1234" {...form.register("plateNumber")} />
          </label>
          {form.formState.errors.plateNumber ? <p role="alert" className="text-sm text-red-600">{form.formState.errors.plateNumber.message}</p> : null}
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">اللون</span>
            <select
              value={color ?? ""}
              onChange={(event) => form.setValue("color", event.target.value, { shouldValidate: true })}
              onBlur={() => form.trigger("color")}
              className="select-field w-full"
            >
              <option value="">اختار اللون…</option>
              {BUS_COLORS.map((option) => (
                <option key={option.name} value={option.name}>{option.name}</option>
              ))}
            </select>
          </label>
          {color ? (
            <div className="flex items-center gap-2 text-sm text-[#5e6b78]">
              <span className="inline-block size-6 rounded-full border border-[#d8e4ec]" style={{ backgroundColor: BUS_COLORS.find((c) => c.name === color)?.hex ?? "transparent" }} />
              {color}
            </div>
          ) : null}
          {form.formState.errors.color ? <p role="alert" className="text-sm text-red-600">{form.formState.errors.color.message}</p> : null}
          <ImagePicker
            label="صورة العربية"
            file={imageFile}
            onChange={(file) => void onFileSelect(file)}
            uploading={uploading}
            required
            hint="الصورة بتترفع كملف (FormData) للتخزين السحابي تلقائيًا."
          />
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">الماركة <span className="font-normal text-slate-400">(اختياري)</span></span>
            <select
              {...form.register("brandId")}
              className="select-field w-full"
            >
              <option value="">بدون ماركة…</option>
              {(brands ?? []).filter((brand) => brand.isActive).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">سنة الموديل <span className="font-normal text-slate-400">(اختياري)</span></span>
              <Input
                dir="ltr"
                inputMode="numeric"
                type="number"
                min={1980}
                max={2100}
                placeholder="2022"
                {...form.register("modelYear", { setValueAs: (value) => (value === "" || value == null ? undefined : Number(value)) })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">السعة (1–300)</span>
              <Input
                dir="ltr"
                inputMode="numeric"
                type="number"
                min={1}
                max={300}
                {...form.register("capacity", { setValueAs: (value) => (value === "" || value == null ? undefined : Number(value)) })}
              />
            </label>
          </div>
          {(form.formState.errors.modelYear || form.formState.errors.capacity) ? (
            <p role="alert" className="text-sm text-red-600">
              {form.formState.errors.modelYear?.message ?? form.formState.errors.capacity?.message}
            </p>
          ) : null}
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" {...form.register("isAirConditioned")} className="size-4" />
            مكيّف
          </label>
          {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-2 border-t border-[#e4ecf2] pt-4">
            <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>إلغاء</Button>
            <Button type="submit" variant="success" disabled={form.formState.isSubmitting || uploading}>
              {form.formState.isSubmitting ? "جاري الحفظ…" : "إضافة العربية"}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

export default function BusesPage() {
  const { data: first, isLoading, error } = useDataQuery<BusAggregatePage>(
    qk.busesAggregate,
    () => fetchAggregateBusPage(null),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [listFilters, setListFilters] = useState<{ q?: string; status?: string }>({});

  const query = (listFilters.q ?? "").trim();
  const status = listFilters.status ?? "all";
  const predicate = (bus: BusRow) =>
    (!query || bus.registrationNumber.includes(query) || (bus.plateNumber ?? "").includes(query) || bus.fleetName.includes(query)) &&
    (status === "all" || (status === "active" ? bus.isActive : !bus.isActive));

  const columns: CommunityColumnDef<BusRow>[] = useMemo(() => [
    { field: "registrationNumber", headerName: "رقم التسجيل", filter: "agTextColumnFilter" },
    { field: "plateNumber", headerName: "رقم اللوحة", filter: "agTextColumnFilter" },
    { field: "fleetName", headerName: "اسم الأسطول", filter: "agTextColumnFilter" },
    { field: "capacity", headerName: "السعة", filter: "agNumberColumnFilter" },
    { field: "isActive", headerName: "الحالة", filter: "agTextColumnFilter", cellDataType: "text", valueFormatter: (params) => params.value ? "نشط" : "موقوف" },
    { field: "createdAt", headerName: "تاريخ الإنشاء", filter: "agDateColumnFilter", valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString("ar-EG") : "—" },
  ], []);

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">العربيات</h1>
          <p className="page-description">كل العربيات في الأساطيل المسجلة، مع حالتها وبيانات تشغيلها.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>عربية جديدة</Button>
      </div>

      {error ? <p role="alert" className="text-sm text-red-600">{error.message}</p> : null}
      {isLoading ? <p className="text-sm text-[#606060]">جاري تحميل العربيات…</p> : (
        <CursorList<BusRow>
          initialItems={first?.items ?? []}
          initialCursor={first?.nextCursor ?? null}
          loadMore={fetchAggregateBusPage}
          keyOf={(bus) => bus.id}
          filter={predicate}
          columnDefs={columns}
          filterBar={
            <div className="contents">
              <Input
                aria-label="بحث برقم التسجيل أو اللوحة أو الأسطول"
                placeholder="رقم التسجيل أو اللوحة أو الأسطول"
                value={listFilters.q ?? ""}
                onChange={(event) => setListFilters((current) => ({ ...current, q: event.target.value }))}
                className="max-w-xs bg-white"
              />
              <select aria-label="الحالة" value={status} onChange={(event) => setListFilters((current) => ({ ...current, status: event.target.value }))} className="select-field">
                <option value="all">الكل</option>
                <option value="active">نشط</option>
                <option value="inactive">موقوف</option>
              </select>
            </div>
          }
          emptyMessage="لا توجد عربيات مسجلة في الأساطيل."
          renderItem={(bus) => <Link href={`/buses/${bus.id}?fleetId=${bus.fleetId}`} className="list-card"><span className="font-semibold"><span dir="ltr">{bus.registrationNumber}</span><span className="mt-1 block text-xs text-[#606060]">{bus.fleetName}</span></span><span className="text-sm text-[#606060]">فتح</span></Link>}
        />
      )}
      <CreateBusDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
