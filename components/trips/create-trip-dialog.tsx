"use client";

import { Select } from "@/components/ui/select";
import { DriverPicker } from "@/components/buses/driver-picker";

import * as schemas from "@/lib/schemas/p1";

import { schemaErrors, requiredField } from "@/lib/field-validation";

import { useFieldValidation } from "@/components/ui/field-validation";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { OwnerPicker } from "@/components/owners/owner-picker";
import { createTrip, type Trip } from "@/lib/actions/trips";
import {
  fetchOwnerTripLinesPage,
  lineEndpoints,
  type TripLine,
} from "@/lib/actions/trip-lines";
import { fetchBusesPage, type Bus } from "@/lib/actions/buses";
import { setOwnerScopeCookie } from "@/lib/owner-scope-cookie";
import { qk, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";
import { applyMutationCache, tripImpact } from "@/lib/cache/mutations";
import { useFilterStore } from "@/stores/filters";
import { t } from "@/lib/i18n/t";

/**
 * نافذة إنشاء رحلة — الخط هو اللي بيحدد الوجهة، فاختيار العربية بس هو اللي
 * مطلوب معاه. مفيش من/إلى ولا اتجاه: الرحلة ورا خط واحد في اتجاه واحد.
 */
export function CreateTripDialog({
  open,
  onClose,
  lockedOwnerId,
  lockedLineId,
  lockedBusId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** When set, the owner company is fixed and the picker is hidden. */
  lockedOwnerId?: string;
  /** Pre-selected trip line (e.g. from the bus detail page). */
  lockedLineId?: string;
  /** Pre-selected bus (e.g. from the bus detail page). */
  lockedBusId?: string;
  /** Extra cache hook for callers with their own list (e.g. the owner tab). */
  onCreated?: (trip: Trip) => void;
}) {
  const queryClient = useQueryClient();
  const scopedOwnerId = useFilterStore((s) => s.ownerId);
  const setOwnerId = useFilterStore((s) => s.setOwnerId);
  const [pickedOwnerId, setPickedOwnerId] = useState("");
  // A locked owner (opened from the bus page) wins; otherwise the modal's own
  // picker wins, falling back to the page filter so it comes prefilled.
  const ownerId = (lockedOwnerId ?? pickedOwnerId) || (scopedOwnerId ?? "");
  const [lineId, setLineId] = useState(lockedLineId ?? "");
  const [busId, setBusId] = useState(lockedBusId ?? "");
  const [driverUserId, setDriverUserId] = useState("");
  const [departAt, setDepartAt] = useState("");
  const [fare, setFare] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: linesPage } = useApiQuery(
    qk.tripLines(ownerId || "none"),
    () => fetchOwnerTripLinesPage(ownerId, null),
    { enabled: open && Boolean(ownerId) },
  );
  const { data: busesPage } = useApiQuery(
    qk.buses(ownerId || "none"),
    () => fetchBusesPage(ownerId, null),
    { enabled: open && Boolean(ownerId) },
  );

  const lines: TripLine[] = useMemo(() => linesPage?.items ?? [], [linesPage]);
  const buses: Bus[] = useMemo(
    () => (busesPage?.items ?? []).filter((bus) => bus.isActive),
    [busesPage],
  );
  const selectedLine = lines.find((line) => line.id === lineId);
  const endpoints = selectedLine ? lineEndpoints(selectedLine) : null;

  function resetForm() {
    validation.reset();
    setPickedOwnerId("");
    setLineId(lockedLineId ?? "");
    setBusId(lockedBusId ?? "");
    setDriverUserId("");
    setDepartAt("");
    setFare("");
    setError(null);
  }

  const validation = useFieldValidation(() => ({ ...schemaErrors(schemas.createTripSchema, { busId, driverUserId, departAt, fare: selectedLine?.pricingEnabled ? undefined : fare.trim() || undefined }), ownerId: requiredField(ownerId), lineId: requiredField(lineId) }));

  async function submit() {
    if (!validation.validate()) return;

    setError(null);
    setSaving(true);
    setOwnerId(ownerId);
    setOwnerScopeCookie(ownerId);
    const result = await createTrip(ownerId, lineId, {
      busId,
      driverUserId,
      departAt: new Date(departAt).toISOString(),
      fare: selectedLine?.pricingEnabled ? undefined : fare.trim() || undefined,
    });
    setSaving(false);
    if (!result.ok) return setError(validation.failure(result));
    // One impact declaration covers the global `all` index, the owner index, the
    // line index and the detail slot — patching only `qk.trips(owner, line)`
    // left the global list missing the new trip until something else refetched.
    applyMutationCache(
      queryClient,
      tripImpact({ trip: { id: result.data.id, ownerId: result.data.ownerId, lineId }, mode: "insert" }),
      result,
    );
    // تحديث فوري لجدول الرحلات من غير إعادة تحميل
    upsertInCursorList<Trip>(queryClient, qk.trips(ownerId, lineId), result.data);
    onCreated?.(result.data);
    resetForm();
    onClose();
  }

  return (
    <Dialog validation={validation}
      open={open}
      onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }}
      title={t("trips.createDialog.title")}
      description={t("trips.createDialog.description")}
      size="sm"
    >
      <form noValidate
        className="space-y-4"
        onSubmit={(event) => { event.preventDefault(); void submit(); }}
      >
        {lockedOwnerId ? null : (
          <div className="rounded-2xl border border-[#dce8ef] bg-[#f8fbfd] p-3">
            <OwnerPicker
              ownerId={ownerId}
              onOwnerChange={(next) => {
                setPickedOwnerId(next);
                setLineId("");
                setBusId("");
                setDriverUserId("");
              }}
            />
          </div>
        )}

        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.tripLine")}</span>
          <Select fieldName="lineId"
            value={lineId}
            onChange={(event) => setLineId(event.target.value)}
            disabled={!ownerId || Boolean(lockedLineId)}
            className="select-field w-full"
          >
            <option value="">{t("trips.createDialog.pickLine")}</option>
            {lines.filter((line) => line.isActive).map((line) => {
              const ends = lineEndpoints(line);
              return (
                <option key={line.id} value={line.id}>
                  {line.name} · {ends.origin ?? "—"} ← {ends.destination ?? "—"}
                </option>
              );
            })}
          </Select>
          {endpoints ? (
            <small className="mt-1 block text-xs text-[#687886]">
              {endpoints.origin ?? "—"} ← {endpoints.destination ?? "—"}
            </small>
          ) : null}
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.bus")}</span>
          <Select fieldName="busId"
            value={busId}
            onChange={(event) => setBusId(event.target.value)}
            disabled={!ownerId || Boolean(lockedBusId)}
            className="select-field w-full"
          >
            <option value="">{t("trips.createDialog.pickBus")}</option>
            {buses.map((bus) => (
              <option key={bus.id} value={bus.id}>
                {bus.plateNumber ?? t("common.value.withoutName")}
              </option>
            ))}
          </Select>
        </label>

        {ownerId ? <fieldset disabled={saving}><DriverPicker ownerId={ownerId} value={driverUserId} onChange={setDriverUserId} /></fieldset> : null}
        <p className="text-xs text-[#687886]">{t("tripAssignment.notice")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.departAt")}</span>
            <Input fieldName="departAt" dir="ltr" type="datetime-local" value={departAt} onChange={(event) => setDepartAt(event.target.value)} />
          </label>
          {selectedLine?.pricingEnabled ? <p className="self-center text-sm text-slate-600">{t("pricing.managedOnLine")}</p> : <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.fare")} <span className="font-normal text-slate-400">{t("common.value.optional")}</span></span>
            <Input fieldName="fare" dir="ltr" inputMode="decimal" value={fare} onChange={(event) => setFare(event.target.value)} placeholder="50.00" />
          </label>}
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>{t("common.actions.cancel")}</Button>
          <Button type="submit" variant="success" loading={saving}>
            {saving ? t("common.loading.saving") : t("trips.createDialog.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
