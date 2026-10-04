"use client";

import { Select } from "@/components/ui/select";

import * as schemas from "@/lib/schemas/p1";

import { schemaErrors, requiredField } from "@/lib/field-validation";

import { useFieldValidation } from "@/components/ui/field-validation";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, MapPin, Plus, Route, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { OwnerPicker } from "@/components/owners/owner-picker";
import {
  createOwnerTripLine,
  fetchStops,
  type Stop,
  type TripLine,
} from "@/lib/actions/trip-lines";
import { qk, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";
import { applyMutationCache, tripLineImpact } from "@/lib/cache/mutations";
import { t } from "@/lib/i18n/t";

type StopUse = "BOARDING" | "LANDING";
type EditableStop = { key: string; stop: Stop; stopType: StopUse };

const stopUseLabels: Record<StopUse, string> = {
  BOARDING: t("enums.stopUse.boarding"),
  LANDING: t("enums.stopUse.landing"),
};

/**
 * نافذة إنشاء خط رحلة — خط واحد اتجاه واحد بقائمة محطات مرتبة. الرجوع بينVICE
 * خط تاني منفصل، فمفيش اتجاهين في نفس الخط.
 */
export function CreateTripLineDialog({
  open,
  onClose,
  lockedOwnerId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** When set, the owner company is fixed and the picker is hidden. */
  lockedOwnerId?: string;
  /** Extra cache hook for callers with their own list (e.g. the owner tab). */
  onCreated?: (line: TripLine) => void;
}) {
  const queryClient = useQueryClient();
  const [pickedOwnerId, setPickedOwnerId] = useState("");
  // A locked owner (opened from a company tab) wins over anything picked here.
  const ownerId = lockedOwnerId ?? pickedOwnerId;
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [stops, setStops] = useState<EditableStop[]>([]);
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [keySeq, setKeySeq] = useState(0);

  const { data: available } = useApiQuery<Stop[]>(qk.stops, fetchStops, { enabled: open });
  const activeStops = (available ?? []).filter((stop) => stop.isActive);
  // A station can appear twice as an adjacent BOARDING + LANDING pair; a third
  // copy can never validate server-side (DUPLICATE_STOP).
  const remaining = useMemo(
    () => activeStops.filter((stop) => stops.filter((item) => item.stop.id === stop.id).length < 2),
    [activeStops, stops],
  );

  function addStop() {
    const stop = activeStops.find((item) => item.id === pick);
    if (!stop) return;
    if (stops.filter((item) => item.stop.id === stop.id).length >= 2) return;
    const existing = stops.find((item) => item.stop.id === stop.id);
    // Second copy defaults to the opposite capability so the pair is valid as
    // written; the server still enforces BOARDING + LANDING.
    const stopType: StopUse = existing ? (existing.stopType === "BOARDING" ? "LANDING" : "BOARDING") : "BOARDING";
    setStops((items) => [...items, { key: `${stop.id}#new-${keySeq}`, stop, stopType }]);
    setKeySeq((seq) => seq + 1);
    setPick("");
    setError(null);
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= stops.length) return;
    setStops((items) => {
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeRow(index: number) {
    setStops((items) => items.filter((_, itemIndex) => itemIndex !== index));
  }

  function resetForm() {
    validation.reset();
    setName("");
    setCode("");
    setStops([]);
    setPick("");
    setError(null);
  }

  const validation = useFieldValidation(() => ({ ...schemaErrors(schemas.createTripLineSchema, { name: name.trim(), code: code.trim(), stops: stops.map((item) => ({ stopId: item.stop.id, stopType: item.stopType })) }), ownerId: requiredField(ownerId) }));

  async function submit() {
    if (!validation.validate()) return;

    setError(null);
    setSaving(true);
    const result = await createOwnerTripLine(ownerId, {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      stops: stops.map((item) => ({ stopId: item.stop.id, stopType: item.stopType })),
    });
    setSaving(false);
    if (!result.ok) return setError(validation.failure(result));
    // تحديث فوري لجدول الخطوط من غير إعادة تحميل — ومعاه سطور الرحلة
    // والاختيارات اللي بتقرأ نفس السطر، عشان تظهر الرحلة الجديدة على طول.
    applyMutationCache(queryClient, tripLineImpact(ownerId, result.data, "insert"), result);
    upsertInCursorList<TripLine>(queryClient, qk.tripLines(ownerId), result.data);
    onCreated?.(result.data);
    resetForm();
    onClose();
  }

  const routeSummary =
    stops.length >= 2 ? `${stops[0].stop.name} ← ${stops[stops.length - 1].stop.name}` : t("tripLines.incomplete");

  return (
    <Dialog validation={validation} open={open} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title={t("tripLines.createDialog.title")} description={t("tripLines.createDialog.description")} size="lg">
      <form noValidate className="space-y-6" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        {lockedOwnerId ? null : (
          <div className="rounded-2xl border border-[#dce8ef] bg-[#f8fbfd] p-4">
            <OwnerPicker ownerId={ownerId} onOwnerChange={setPickedOwnerId} />
          </div>
        )}

        <div className="grid gap-3 rounded-2xl border border-[#dce8ef] bg-[#f8fbfd] p-4 sm:grid-cols-[1fr_12rem]">
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("tripLines.metaDialog.nameLabel")}</span>
            <Input fieldName="name" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("tripLines.placeholders.name")} />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("tripLines.metaDialog.codeLabel")}</span>
            <Input fieldName="code" dir="ltr" value={code} onChange={(event) => setCode(event.target.value)} placeholder="CAI-BNS" />
          </label>
        </div>

        <section className="overflow-hidden rounded-[1.5rem] border border-[#cfe1ec] bg-gradient-to-br from-[#eaf6ff] via-white to-[#fff7e3]/60">
          <div className="flex items-center gap-2 border-b border-[#dce8ef] p-4 text-[#00134c] sm:p-5">
            <Route className="size-5 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-extrabold">{t("tripLines.createDialog.routeTitle")}</h3>
              <p className="mt-0.5 text-xs font-normal text-[#687886]">{t("tripLines.createDialog.routeHint")}</p>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="flex gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-[#dbe7ee]">
              <Select fieldName="stops" aria-label={t("tripLines.stopsDialog.pickStop")} value={pick} onChange={(event) => setPick(event.target.value)} className="select-field min-w-0 flex-1 border-0 bg-transparent">
                <option value="">{t("tripLines.stopsDialog.pickStopTo")}…</option>
                {remaining.map((stop) => <option key={stop.id} value={stop.id}>{stop.name} · {stop.address}</option>)}
              </Select>
              <Button type="button" variant="secondary" onClick={addStop} disabled={!pick}><Plus className="size-4" /> {t("common.actions.add")}</Button>
            </div>
            {stops.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[#b9d2e3] bg-white/70 px-5 py-9 text-center">
                <MapPin className="mx-auto mb-2 size-7 text-[#059ff8]" />
                <p className="font-bold text-[#334454]">{t("tripLines.createDialog.emptyTitle")}</p>
                <p className="mt-1 text-sm text-[#687886]">{t("tripLines.createDialog.emptyHint")}</p>
              </div>
            ) : (
              <ol className="mt-4 space-y-0">
                {stops.map((item, index) => (
                  <li key={item.key} className="flex gap-3">
                    <div className="flex w-8 shrink-0 flex-col items-center">
                      <span className={`grid size-8 place-items-center rounded-full text-xs font-extrabold ${index === 0 ? "bg-[#00134c] text-white" : index === stops.length - 1 ? "bg-[#059ff8] text-white" : "bg-[#d6eeff] text-[#00134c]"}`}>{index + 1}</span>
                      {index < stops.length - 1 && <span className="my-1 min-h-5 flex-1 border-r-2 border-dashed border-[#9dc2da]" />}
                    </div>
                    <div className="mb-2 flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-[#dbe7ee]">
                      <MapPin className="size-4 shrink-0 text-[#059ff8]" />
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{item.stop.name}</strong>
                        <small className="block truncate text-xs text-[#687886]">{item.stop.address}</small>
                      </span>
                      <Select
                        aria-label={t("tripLines.stopsDialog.stopTypeLabel")}
                        fieldName={`stops.${index}.stopType`} value={item.stopType}
                        onChange={(event) => setStops((items) => items.map((entry, entryIndex) => (entryIndex === index ? { ...entry, stopType: event.target.value as StopUse } : entry)))}
                        className="select-field w-24 shrink-0 py-2 text-xs sm:w-28"
                      >
                        <option value="BOARDING">{t("enums.stopUse.boarding")}</option>
                        <option value="LANDING">{t("enums.stopUse.landing")}</option>
                      </Select>
                      <div className="flex shrink-0">
                        <Button type="button" variant="ghost" size="icon" aria-label={t("tripLines.stopsDialog.moveUp")} onClick={() => move(index, -1)} disabled={index === 0}><ArrowUp /></Button>
                        <Button type="button" variant="ghost" size="icon" aria-label={t("tripLines.stopsDialog.moveDown")} onClick={() => move(index, 1)} disabled={index === stops.length - 1}><ArrowDown /></Button>
                        <Button type="button" variant="ghost" size="icon" aria-label={t("common.actions.delete")} onClick={() => removeRow(index)}><Trash2 /></Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <div className="rounded-2xl bg-[#00134c] p-4 text-white">
          <span className="text-xs text-[#9ed0f0]">{t("tripLines.stopsDialog.summary")}</span>
          <br />
          <strong>{routeSummary}</strong>
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>{t("common.actions.cancel")}</Button>
          <Button type="submit" variant="success" loading={saving} disabled={saving}>
            {saving ? t("common.loading.saving") : t("tripLines.createDialog.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
