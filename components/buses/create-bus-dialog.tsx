"use client";

import { useMemo, useState } from "react";
import { schemaErrors, requiredField } from "@/lib/field-validation";
import { useFieldValidation } from "@/components/ui/field-validation";
import { Select } from "@/components/ui/select";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ui/image-picker";
import {
  assignDriver,
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
import { applyMutationCache, busImpact, evictImpact } from "@/lib/cache/mutations";
import { useFilterStore } from "@/stores/filters";
import { OwnerPicker } from "@/components/owners/owner-picker";
import { setOwnerScopeCookie } from "@/lib/owner-scope-cookie";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n/t";

type BusRow = Bus & { ownerId: string; ownerName: string };

type CreateValues = z.input<typeof createBusSchema>;

export type FixedBusDriver = {
  userId: string;
  ownerId: string;
  ownerLabel?: string | null;
  driverLabel?: string | null;
};

/**
 * نافذة إضافة عربية — من غير رقم تسجيل (بيتولد تلقائيًا) واللون قايمة بمعاينة.
 * تُستخدم في صفحة العربيات وفي تبويب عربيات الشركة (lockedOwnerId يثبّت الشركة).
 *
 * كل عربية بتعود لصاحب عربيه واحد: صفحة العربيات بتختار المالك من المنتقي،
 * وfixedDriver يثبّت النطاق على عربيه سواق معيّن (إضافة عربية من صف السواق)
 * ويعيّن العربية الجديدة عليه في نفس الخطوة (إنشاء ثم تعيين برسالة واحدة،
 * مع تنظيف الصورة المرحلية عند فشل الإنشاء وإعادة تعيين فقط عند فشل التعيين).
 */
export function CreateBusDialog({
  open,
  onClose,
  onCreated,
  lockedOwnerId,
  fixedDriver,
}: {
  open: boolean;
  onClose: () => void;
  /** Extra cache hook for callers with their own list (e.g. owner tab). */
  onCreated?: (bus: Bus) => void;
  /** When set, the owner company is fixed and the picker is hidden. */
  lockedOwnerId?: string;
  /** When set, the owner scope is fixed to the driver's scope and the new bus is assigned to them. */
  fixedDriver?: FixedBusDriver | null;
}) {
  const queryClient = useQueryClient();
  const { ownerId: scopedOwnerId, setOwnerId } = useFilterStore();
  const [localOwnerId, setLocalOwnerId] = useState(lockedOwnerId ?? scopedOwnerId ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** A bus saved while its follow-up assignment failed — retry assigns only, never recreates. */
  const [createdBus, setCreatedBus] = useState<Bus | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  const fixedKey = fixedDriver ? `${fixedDriver.ownerId}/${fixedDriver.userId}` : "";
  // Reset everything when the dialog opens for another row — in render phase
  // (no setState-in-effect).
  const contextKey = open ? `open|${lockedOwnerId ?? ""}|${fixedKey}` : "closed";
  const [seenContext, setSeenContext] = useState("closed");
  if (seenContext !== contextKey) {
    setSeenContext(contextKey);
    setLocalOwnerId(lockedOwnerId ?? scopedOwnerId ?? "");
    setImageFile(null);
    setUploading(false);
    setBusy(false);
    setFormError(null);
    setCreatedBus(null);
    setAssignError(null);
  }

  const { data: brands, isPending: brandsPending } = useApiQuery<VehicleBrand[]>(qk.brands, () => fetchBrands(true), { enabled: open });
  const showOwnerPicker = !lockedOwnerId && !fixedDriver;
  const { data: ownersPage } = useApiQuery(qk.fleetOwners, () => fetchFleetOwnersPage(null), { enabled: open && showOwnerPicker });
  const ownerName = useMemo(
    () => (ownersPage?.items ?? []).find((owner) => owner.id === localOwnerId)?.name ?? "—",
    [ownersPage, localOwnerId],
  );

  // The effective tenant: locked company, the fixed driver's scope, or the
  // picked owner. It is form state only — never sent as an API field.
  const effectiveOwnerId = lockedOwnerId ?? fixedDriver?.ownerId ?? localOwnerId;
  const assignTargetUserId = fixedDriver?.userId ?? null;

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

  const formValues = useWatch({ control: form.control });
  const validation = useFieldValidation(() => ({ ...schemaErrors(createBusSchema, formValues), ownerId: requiredField(effectiveOwnerId), imageUrl: imageFile ? validateImageFile(imageFile) ?? undefined : t("buses.createDialog.errors.imageRequired") }));

  function resetForm() {
    validation.reset();
    setImageFile(null);
    setFormError(null);
    setCreatedBus(null);
    setAssignError(null);
    form.reset();
  }

  function requestClose() {
    // A save in flight must finish first: closing mid-write would orphan the
    // staged image handling and hide the outcome of a bus already created.
    if (busy || uploading) return;
    resetForm();
    onClose();
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

  function publishCreatedBus(bus: Bus, ownerLabel: string) {
    // تحديث فوري للجداول من غير إعادة تحميل — ومعاه عرض العربية ورحلاتها
    applyMutationCache(queryClient, busImpact({ id: bus.id, ownerId: bus.ownerId }, "insert"), { ok: true, data: bus });
    upsertInCursorList<BusRow>(queryClient, qk.busesAggregate, { ...bus, ownerId: bus.ownerId, ownerName: ownerLabel });
    onCreated?.(bus);
  }

  async function onSubmit(values: CreateValues) {
    if (busy) return;
    setFormError(null);
    const ownerId = effectiveOwnerId;
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
    setBusy(true);
    setUploading(true);
    const stagedResult = await stageBusImage(ownerId, imageFile);
    if (!stagedResult.ok) {
      setUploading(false);
      setBusy(false);
      setFormError(validation.failure(stagedResult));
      return;
    }
    const staged: StagedUpload = stagedResult.data;
    const ownerLabel = fixedDriver?.ownerLabel ?? ownerName;
    // The composed flow owns its single outcome message, so the individual
    // steps stay silent and only the combined result is announced.
    const silent = assignTargetUserId ? { notify: false as const } : undefined;
    const r = await createBus(ownerId, {
      ...values,
      imageUrl: staged.publicUrl,
      registrationNumber: values.registrationNumber || undefined,
      brandId: values.brandId || null,
      modelYear: values.modelYear ?? undefined,
    }, silent);
    setUploading(false);
    if (!r.ok) {
      await discardBusImage(ownerId, staged);
      setBusy(false);
      setFormError(validation.failure(r));
      return;
    }
    publishCreatedBus(r.data, ownerLabel);
    if (!assignTargetUserId) {
      setBusy(false);
      resetForm();
      onClose();
      return;
    }
    const assigned = await assignDriver(ownerId, r.data.id, { driverUserId: assignTargetUserId }, { notify: false });
    setBusy(false);
    if (!assigned.ok) {
      // Partial success: the bus and its image are saved and already visible;
      // only the assignment is retried — never a second bus.
      setCreatedBus(r.data);
      setAssignError(t("buses.createDialog.partialSuccess", { reason: assigned.message }));
      return;
    }
    applyMutationCache(
      queryClient,
      evictImpact(["drivers"], ["owner-drivers"], ["driver"], ["driver-assignments"], ["driver-trip-rows"], ["driver-ratings"]),
      { ok: true, data: null },
    );
    toast.success(t("buses.createDialog.createdAndAssigned"));
    resetForm();
    onClose();
  }

  async function retryAssignment() {
    if (!createdBus || busy) return;
    setBusy(true);
    setAssignError(null);
    const target = fixedDriver?.userId;
    if (!target) {
      setBusy(false);
      return;
    }
    const result = await assignDriver(createdBus.ownerId, createdBus.id, { driverUserId: target }, { notify: false });
    setBusy(false);
    if (!result.ok) {
      setAssignError(t("buses.createDialog.partialSuccess", { reason: result.message }));
      return;
    }
    applyMutationCache(
      queryClient,
      evictImpact(["drivers"], ["owner-drivers"], ["driver"], ["driver-assignments"], ["driver-trip-rows"], ["driver-ratings"]),
      { ok: true, data: null },
    );
    toast.success(t("buses.createDialog.createdAndAssigned"));
    resetForm();
    onClose();
  }

  const color = formValues.color;

  return (
    <Dialog validation={validation} open={open} onOpenChange={(next) => { if (!next) requestClose(); }} title={t("buses.createDialog.title")} description={t("buses.createDialog.description")} size="sm">
      {createdBus ? (
        <div className="space-y-4">
          <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{assignError}</p>
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="danger" onClick={requestClose} disabled={busy}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="button" variant="success" onClick={() => void retryAssignment()} loading={busy}>
              {t("buses.createDialog.retryAssignment")}
            </Button>
          </div>
        </div>
      ) : (
      <div>
        {fixedDriver ? (
          <p className="mb-4 rounded-xl bg-[#f2f8fb] p-3 text-sm text-[#334454]">
            {t("buses.createDialog.fixedDriverNote", {
              owner: fixedDriver.ownerLabel ?? fixedDriver.ownerId.slice(0, 8),
              driver: fixedDriver.driverLabel ?? fixedDriver.userId.slice(0, 8),
            })}
          </p>
        ) : null}
        {showOwnerPicker ? (
          <div className="mb-4">
            <OwnerPicker ownerId={localOwnerId} onOwnerChange={setLocalOwnerId} />
          </div>
        ) : null}
        <form
          onSubmit={(event) => { event.preventDefault(); const valid = validation.validate(); void form.handleSubmit((values) => { if (valid) return onSubmit(values); })(event); }}
          className="space-y-4"
          noValidate
        >
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.plateNumber")}</span>
            <Input fieldName="plateNumber" dir="ltr" placeholder={t("buses.placeholders.plateNumber")} {...form.register("plateNumber")} />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.color")}</span>
            <Select fieldName="color"
              value={color ?? ""}
              onChange={(event) => form.setValue("color", event.target.value, { shouldValidate: true })}
              onBlur={() => form.trigger("color")}
              className="select-field w-full"
            >
              <option value="">{t("buses.detail.pickColor")}</option>
              {BUS_COLORS.map((option) => (
                <option key={option.name} value={option.name}>{option.name}</option>
              ))}
            </Select>
          </label>
          {color ? (
            <div className="flex items-center gap-2 text-sm text-[#5e6b78]">
              <span className="inline-block size-6 rounded-full border border-[#d8e4ec]" style={{ backgroundColor: BUS_COLORS.find((c) => c.name === color)?.hex ?? "transparent" }} />
              {color}
            </div>
          ) : null}
          <ImagePicker
            fieldName="imageUrl"
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
              <Select fieldName="brandId"
                {...form.register("brandId")}
                className="select-field w-full"
              >
                <option value="">{t("buses.detail.noBrand")}</option>
                {(brands ?? []).filter((brand) => brand.isActive).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
              </Select>
            )}
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.modelYear")} <span className="font-normal text-slate-400">{t("common.value.optional")}</span></span>
              <Input fieldName="modelYear"
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
              <Input fieldName="capacity"
                dir="ltr"
                inputMode="numeric"
                type="number"
                min={1}
                max={300}
                {...form.register("capacity", { setValueAs: (value) => (value === "" || value == null ? undefined : Number(value)) })}
              />
            </label>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" {...form.register("isAirConditioned")} className="size-4" />
            {t("common.fields.ac")}
          </label>
          {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
            <Button type="button" variant="danger" onClick={requestClose} disabled={busy || uploading}>{t("common.actions.cancel")}</Button>
            <Button type="submit" variant="success" loading={form.formState.isSubmitting || uploading || busy}>
              {form.formState.isSubmitting ? t("common.loading.saving") : t("buses.createDialog.submit")}
            </Button>
          </div>
        </form>
      </div>
      )}
    </Dialog>
  );
}
