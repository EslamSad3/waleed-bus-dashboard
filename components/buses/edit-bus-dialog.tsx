"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ui/image-picker";
import { fetchBrands, fetchBus, updateBus, uploadBusImage, type Bus, type VehicleBrand } from "@/lib/actions/buses";
import { BUS_COLORS } from "@/lib/colors";
import { qk, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";

type BusRow = Bus & { fleetName?: string };

/** بعد رفع صورة جديدة نجيب الـ row المحدث من السيرفر (الـ PATCH بيرجع الصورة القديمة). */
async function refetchBusRow(bus: BusRow): Promise<Bus> {
  const fresh = await fetchBus(bus.fleetId, bus.id);
  return fresh.ok ? fresh.data : bus;
}

/**
 * نافذة تعديل عربية — نفس حقول الإضافة من غير رقم التسجيل (ثابت) والأسطول (مش بيتغير).
 * الصورة بتترفع FormData زي الإضافة بالظبط.
 */
export function EditBusDialog({
  open,
  bus,
  onClose,
}: {
  open: boolean;
  bus: BusRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [plateNumber, setPlateNumber] = useState("");
  const [color, setColor] = useState("");
  const [brandId, setBrandId] = useState("");
  const [modelYear, setModelYear] = useState("");
  const [capacity, setCapacity] = useState("");
  const [isAirConditioned, setIsAirConditioned] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const { data: brands } = useApiQuery<VehicleBrand[]>(qk.brands, () => fetchBrands(true), { enabled: open });

  if (bus && bus.id !== loadedFor) {
    setLoadedFor(bus.id);
    setPlateNumber(bus.plateNumber ?? "");
    setColor(bus.color ?? "");
    setBrandId(bus.brandId ?? "");
    setModelYear(bus.modelYear ? String(bus.modelYear) : "");
    setCapacity(String(bus.capacity ?? ""));
    setIsAirConditioned(Boolean(bus.isAirConditioned));
    setImageFile(null);
    setError(null);
  }

  function resetForm() {
    setLoadedFor(null);
    setImageFile(null);
    setError(null);
  }

  async function submit() {
    if (!bus) return;
    setError(null);
    const seats = Number(capacity);
    if (!plateNumber.trim()) {
      setError("اكتب رقم اللوحة.");
      return;
    }
    if (!color) {
      setError("اختار اللون.");
      return;
    }
    if (!Number.isInteger(seats) || seats < 1 || seats > 300) {
      setError("السعة لازم تكون رقم من 1 لـ 300.");
      return;
    }
    const year = modelYear.trim() === "" ? undefined : Number(modelYear);
    if (year !== undefined && (!Number.isInteger(year) || year < 1980 || year > 2100)) {
      setError("سنة الموديل لازم تكون بين 1980 و 2100.");
      return;
    }
    setSaving(true);
    const result = await updateBus(bus.fleetId, bus.id, {
      plateNumber: plateNumber.trim(),
      color,
      brandId: brandId || null,
      isAirConditioned,
      ...(year !== undefined ? { modelYear: year } : {}),
      capacity: seats,
    });
    if (!result.ok) {
      setSaving(false);
      setError(result.message);
      return;
    }
    if (imageFile) {
      const uploaded = await uploadBusImage(bus.fleetId, imageFile, { notify: false });
      if (!uploaded.ok) setError(uploaded.message);
    }
    setSaving(false);
    // الصورة بتتحدّث من غير رفريش — نجيب الـ row المحدث ونحطه في الكاش
    const after = imageFile ? await refetchBusRow(bus) : result.data;
    upsertInCursorList<BusRow>(queryClient, qk.busesAggregate, { ...after, fleetName: bus.fleetName });
    upsertInCursorList<Bus>(queryClient, qk.fleetBuses(bus.fleetId), after);
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open && Boolean(bus)} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title="تعديل عربية" description={bus ? `رقم التسجيل ${bus.registrationNumber} — بيانات التشغيل بس هي اللي بتتعدل.` : undefined} size="sm">
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">رقم اللوحة</span>
          <Input dir="ltr" value={plateNumber} onChange={(event) => setPlateNumber(event.target.value)} placeholder="أ ب ج 1234" />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">اللون</span>
          <select value={color} onChange={(event) => setColor(event.target.value)} className="select-field w-full">
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
        <ImagePicker
          label="صورة العربية (اختياري)"
          file={imageFile}
          onChange={setImageFile}
          uploading={uploading}
          hint="لو رفعت صورة جديدة هتتبعت مكان القديمة."
        />
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">الماركة <span className="font-normal text-slate-400">(اختياري)</span></span>
          <select value={brandId} onChange={(event) => setBrandId(event.target.value)} className="select-field w-full">
            <option value="">بدون ماركة…</option>
            {(brands ?? []).filter((brand) => brand.isActive).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">سنة الموديل <span className="font-normal text-slate-400">(اختياري)</span></span>
            <Input dir="ltr" inputMode="numeric" type="number" min={1980} max={2100} value={modelYear} onChange={(event) => setModelYear(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">السعة (1–300)</span>
            <Input dir="ltr" inputMode="numeric" type="number" min={1} max={300} value={capacity} onChange={(event) => setCapacity(event.target.value)} />
          </label>
        </div>
        <label className="flex items-center gap-2 rounded-xl bg-[#f8fbfd] p-3 text-sm">
          <input type="checkbox" checked={isAirConditioned} onChange={(event) => setIsAirConditioned(event.target.checked)} className="size-4 accent-[#059ff8]" />
          مكيّف
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 border-t border-[#e4ecf2] pt-4">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>إلغاء</Button>
          <Button type="button" variant="success" onClick={() => void submit()} loading={saving || uploading}>{saving ? "جاري الحفظ…" : "حفظ التعديلات"}</Button>
        </div>
      </div>
    </Dialog>
  );
}
