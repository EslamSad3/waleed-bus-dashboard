"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ui/image-picker";
import {
  createBus,
  fetchBrands,
  uploadBusImage,
  type Bus,
  type VehicleBrand,
} from "@/lib/actions/buses";
import { fetchFleetsPage, type Fleet } from "@/lib/actions/fleets";
import type { CursorPage } from "@/lib/actions/http";
import { createBusSchema } from "@/lib/schemas/p1";
import { BUS_COLORS } from "@/lib/colors";
import { qk, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";
import { useFilterStore } from "@/stores/filters";
import { FleetPicker } from "@/components/fleet-picker";
import { setFleetScopeCookie } from "@/lib/fleet-scope-cookie";
import { Skeleton } from "@/components/ui/skeleton";

type BusRow = Bus & { fleetName: string };

type CreateValues = z.input<typeof createBusSchema>;

/**
 * نافذة إضافة عربية — من غير رقم تسجيل (بيتولد تلقائيًا) واللون قايمة بمعاينة.
 * تُستخدم في صفحة العربيات وفي تبويب عربيات الأسطول (lockedFleetId يثبّت الأسطول).
 */
export function CreateBusDialog({
  open,
  onClose,
  onCreated,
  lockedFleetId,
}: {
  open: boolean;
  onClose: () => void;
  /** Extra cache hook for callers with their own list (e.g. fleet tab). */
  onCreated?: (bus: Bus) => void;
  /** When set, the fleet is fixed and the picker is hidden. */
  lockedFleetId?: string;
}) {
  const queryClient = useQueryClient();
  const { fleetId: scopedFleetId, setFleetId } = useFilterStore();
  const [fleetId, setLocalFleetId] = useState(lockedFleetId ?? scopedFleetId ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: brands, isPending: brandsPending } = useApiQuery<VehicleBrand[]>(qk.brands, () => fetchBrands(true), { enabled: open });
  const { data: fleetsPage } = useApiQuery<CursorPage<Fleet>>(qk.fleets, () => fetchFleetsPage(null), { enabled: open && !lockedFleetId });
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
    // تحديث فوري للجداول من غير إعادة تحميل
    upsertInCursorList<BusRow>(queryClient, qk.busesAggregate, { ...r.data, fleetName });
    onCreated?.(r.data);
    resetForm();
    onClose();
  }

  const color = form.watch("color");

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title="عربية جديدة" description="سجّل العربية داخل أسطولها: اللوحة واللون والصورة مطلوبين — رقم التسجيل بيتولد تلقائيًا." size="sm">
      <div>
        {lockedFleetId ? null : (
          <div className="mb-4">
            <FleetPicker value={fleetId} onChange={setLocalFleetId} />
          </div>
        )}
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
            {brandsPending ? (
              <Skeleton className="h-[2.75rem] w-full" />
            ) : (
              <select
                {...form.register("brandId")}
                className="select-field w-full"
              >
                <option value="">بدون ماركة…</option>
                {(brands ?? []).filter((brand) => brand.isActive).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
              </select>
            )}
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
            <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>إلغاء</Button>
            <Button type="submit" variant="success" loading={form.formState.isSubmitting || uploading}>
              {form.formState.isSubmitting ? "جاري الحفظ…" : "إضافة العربية"}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
