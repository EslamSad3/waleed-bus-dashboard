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
  discardBusImage,
  fetchBrands,
  stageBusImage,
  type Bus,
  type VehicleBrand,
} from "@/lib/actions/buses";
import { validateImageFile, type StagedUpload } from "@/lib/actions/http";
import { fetchFleetOwnersPage } from "@/lib/actions/fleet-owners";
import { createBusSchema } from "@/lib/schemas/p1";
import { BUS_COLORS } from "@/lib/colors";
import { qk, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";
import { useFilterStore } from "@/stores/filters";
import { OwnerPicker } from "@/components/owners/owner-picker";
import { setOwnerScopeCookie } from "@/lib/owner-scope-cookie";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n/t";

type BusRow = Bus & { ownerId: string; ownerName: string };

type CreateValues = z.input<typeof createBusSchema>;

/**
 * نافذة إضافة عربية — من غير رقم تسجيل (بيتولد تلقائيًا) واللون قايمة بمعاينة.
 * تُستخدم في صفحة العربيات وفي تبويب عربيات الشركة (lockedOwnerId يثبّت الشركة).
 */
export function CreateBusDialog({
  open,
  onClose,
  onCreated,
  lockedOwnerId,
}: {
  open: boolean;
  onClose: () => void;
  /** Extra cache hook for callers with their own list (e.g. owner tab). */
  onCreated?: (bus: Bus) => void;
  /** When set, the owner company is fixed and the picker is hidden. */
  lockedOwnerId?: string;
}) {
  const queryClient = useQueryClient();
  const { ownerId: scopedOwnerId, setOwnerId } = useFilterStore();
  const [ownerId, setLocalOwnerId] = useState(lockedOwnerId ?? scopedOwnerId ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: brands, isPending: brandsPending } = useApiQuery<VehicleBrand[]>(qk.brands, () => fetchBrands(true), { enabled: open });
  const { data: ownersPage } = useApiQuery(qk.fleetOwners, () => fetchFleetOwnersPage(null), { enabled: open && !lockedOwnerId });
  const ownerName = useMemo(
    () => (ownersPage?.items ?? []).find((owner) => owner.id === ownerId)?.name ?? "—",
    [ownersPage, ownerId],
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

  function onFileSelect(file: File | null) {
    setImageFile(file);
    setFormError(null);
    if (!file) {
      form.setValue("imageUrl", "", { shouldValidate: true });
      return;
    }
    // الرفع الفعلي بيحصل مع الحفظ (بعد اختيار الشركة) مباشر للتخزين
    // السحابي — مفيش صور يتيمة لو المستخدم لغى.
    const invalid = validateImageFile(file);
    if (invalid) {
      setFormError(invalid);
      return;
    }
    // عنصر نائب https صالح لاجتياز تحقق النموذج — يُستبدل برابط التخزين
    // الفعلي عند الحفظ ولا يصل للسيرفر أبدًا.
    form.setValue("imageUrl", "https://upload.pending/placeholder", { shouldValidate: true });
  }

  async function onSubmit(values: CreateValues) {
    setFormError(null);
    if (!ownerId) {
      setFormError(t("buses.createDialog.errors.pickOwner"));
      return;
    }
    if (!imageFile) {
      setFormError(t("buses.createDialog.errors.imageRequired"));
      return;
    }
    setOwnerId(ownerId);
    setOwnerScopeCookie(ownerId);
    setUploading(true);
    const stagedResult = await stageBusImage(ownerId, imageFile);
    if (!stagedResult.ok) {
      setUploading(false);
      setFormError(stagedResult.message);
      return;
    }
    const staged: StagedUpload = stagedResult.data;
    const r = await createBus(ownerId, {
      ...values,
      imageUrl: staged.publicUrl,
      registrationNumber: values.registrationNumber || undefined,
      brandId: values.brandId || null,
      modelYear: values.modelYear ?? undefined,
    });
    setUploading(false);
    if (!r.ok) {
      await discardBusImage(ownerId, staged);
      setFormError(r.message);
      return;
    }
    // تحديث فوري للجداول من غير إعادة تحميل
    upsertInCursorList<BusRow>(queryClient, qk.busesAggregate, { ...r.data, ownerId, ownerName });
    onCreated?.(r.data);
    resetForm();
    onClose();
  }

  const color = form.watch("color");

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title={t("buses.createDialog.title")} description={t("buses.createDialog.description")} size="sm">
      <div>
        {lockedOwnerId ? null : (
          <div className="mb-4">
            <OwnerPicker ownerId={ownerId} onOwnerChange={setLocalOwnerId} />
          </div>
        )}
        <form
          onSubmit={(event) => {
            if (!imageFile) {
              event.preventDefault();
              setFormError(t("buses.createDialog.errors.imageRequired"));
              return;
            }
            void form.handleSubmit(onSubmit)(event);
          }}
          className="space-y-4"
          noValidate
        >
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.plateNumber")}</span>
            <Input dir="ltr" placeholder={t("buses.placeholders.plateNumber")} {...form.register("plateNumber")} />
          </label>
          {form.formState.errors.plateNumber ? <p role="alert" className="text-sm text-red-600">{form.formState.errors.plateNumber.message}</p> : null}
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.color")}</span>
            <select
              value={color ?? ""}
              onChange={(event) => form.setValue("color", event.target.value, { shouldValidate: true })}
              onBlur={() => form.trigger("color")}
              className="select-field w-full"
            >
              <option value="">{t("buses.detail.pickColor")}</option>
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
            label={t("buses.detail.imageLabel")}
            file={imageFile}
            onChange={(file) => void onFileSelect(file)}
            uploading={uploading}
            required
            hint={t("buses.detail.imageHint")}
          />
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.brand")} <span className="font-normal text-slate-400">{t("common.value.optional")}</span></span>
            {brandsPending ? (
              <Skeleton className="h-[2.75rem] w-full" />
            ) : (
              <select
                {...form.register("brandId")}
                className="select-field w-full"
              >
                <option value="">{t("buses.detail.noBrand")}</option>
                {(brands ?? []).filter((brand) => brand.isActive).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
              </select>
            )}
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.modelYear")} <span className="font-normal text-slate-400">{t("common.value.optional")}</span></span>
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
              <span className="mb-1.5 block font-bold text-[#334454]">{t("buses.detail.capacityRange")}</span>
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
            {t("common.fields.ac")}
          </label>
          {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
            <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>{t("common.actions.cancel")}</Button>
            <Button type="submit" variant="success" loading={form.formState.isSubmitting || uploading}>
              {form.formState.isSubmitting ? t("common.loading.saving") : t("buses.createDialog.submit")}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
