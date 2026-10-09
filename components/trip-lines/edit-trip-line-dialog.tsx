"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useFieldValidation } from "@/components/ui/field-validation";
import { schemaErrors } from "@/lib/field-validation";
import * as schemas from "@/lib/schemas/p1";
import {
  fetchStops,
  updateOwnerTripLine,
  updateOwnerTripLineStops,
  fetchLineFares,
  fetchOwnerTripLine,
  saveLineFares,
  type FareTable,
  type Stop,
  type TripLine,
} from "@/lib/actions/trip-lines";
import { applyMutationCache, tripLineImpact } from "@/lib/cache/mutations";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";
import { FareMatrix } from "./fare-matrix";
import { fareKey, farePairs, faresPayload } from "@/lib/line-fares";

type StopUse = "BOARDING" | "LANDING";
// Row identity is the line-stop row id (client key for newly added rows) — NOT
// the station id, so reordering never collapses rows.
type EditableStop = { key: string; stop: Stop; stopType: StopUse; estimatedStopMinutes?: number };

function stopsPayload(items: EditableStop[]) {
  return items.map((item) => ({
    stopId: item.stop.id,
    stopType: item.stopType,
    ...(item.estimatedStopMinutes ? { estimatedStopMinutes: item.estimatedStopMinutes } : {}),
  }));
}

function editableStops(line: TripLine): EditableStop[] {
  return [...line.stops]
    .sort((a, b) => a.stopOrder - b.stopOrder)
    .map((item) => ({
      key: item.id,
      stop: item.station,
      stopType: item.stopType === "LANDING" ? "LANDING" : "BOARDING",
      estimatedStopMinutes: item.estimatedStopMinutes ?? undefined,
    }));
}

/**
 * The one editor for a trip line — name, code, status and the ordered stops —
 * shared by the trip-lines grid and the line detail page. Open it by passing a
 * line; `null` closes it.
 */
export function EditTripLineDialog({ line, onClose }: { line: TripLine | null; onClose: () => void }) {
  // Mounted per open (and keyed per line), so every open starts from the line as it is now.
  return line ? <Editor key={line.id} line={line} onClose={onClose} /> : null;
}

function Editor({ line, onClose }: { line: TripLine; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: allStops } = useApiQuery<Stop[]>(qk.stops, fetchStops);
  const [name, setName] = useState(line.name);
  const [code, setCode] = useState(line.code ?? "");
  const [isActive, setIsActive] = useState(line.isActive);
  const [initialStops, setInitialStops] = useState(() => {
    const initial = editableStops(line);
    // A legacy line whose duplicates were dropped always counts as changed.
    return initial.length === line.stops.length ? initial : [];
  });
  const [editStops, setEditStops] = useState<EditableStop[]>(() => editableStops(line));
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [loadedTable, setLoadedTable] = useState<FareTable | null>(null);
  const [originalPrices, setOriginalPrices] = useState<Record<string, string>>({});
  const { data: fareTable, isLoading: faresLoading, error: faresError } = useApiQuery<FareTable>(["line-fares", line.ownerId, line.id], () => fetchLineFares(line.ownerId, line.id));
  if (fareTable && !loadedTable) {
    const values = Object.fromEntries(fareTable.fares.map(f => [fareKey(f), f.unitFare]));
    setLoadedTable(fareTable); setPrices(values); setOriginalPrices(values);
  }
  const pairs = farePairs(editStops.map((s, i) => ({ stationId: s.stop.id, name: s.stop.name, stopType: s.stopType, stopOrder: i + 1 })), loadedTable?.pairs.filter(p => p.scope === "FROZEN_TRIP" || p.protectedForStopEdits) ?? []);
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const keySeq = useRef(0);

  // A stop can be picked only once per line — already-chosen stops leave the
  // picker so a duplicate can never be submitted.
  const remaining = useMemo(
    () => (allStops ?? []).filter((stop) => stop.isActive && !editStops.some((item) => item.stop.id === stop.id)),
    [allStops, editStops],
  );

  const validation = useFieldValidation(() => ({
    ...schemaErrors(schemas.updateTripLineSchema, { name: name.trim(), code: code.trim() || null, isActive }),
    ...schemaErrors(schemas.updateLineStopsSchema, { stops: stopsPayload(editStops), fares: faresPayload(pairs, prices), expectedPricingRevision: loadedTable?.pricingRevision }),
  }));

  function addStop() {
    const stop = remaining.find((item) => item.id === pick);
    if (!stop) return;
    keySeq.current += 1;
    const key = `${stop.id}#new-${keySeq.current}`;
    setEditStops((items) => [...items, { key, stop, stopType: "BOARDING" }]);
    setPick("");
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= editStops.length) return;
    setEditStops((items) => {
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeRow(index: number) {
    setEditStops((items) => items.filter((_, itemIndex) => itemIndex !== index));
  }

  /**
   * Saves only what changed — line fields and stops are separate endpoints —
   * and reports the outcome with a single toast.
   */
  async function saveAll() {
    if (!loadedTable) return setError(t("pricing.loadFailed"));
    if (!validation.validate()) return;
    const nextCode = code.trim() || null;
    const metaChanged = name.trim() !== line.name || nextCode !== (line.code ?? null) || isActive !== line.isActive;
    const stopsChanged = JSON.stringify(stopsPayload(editStops)) !== JSON.stringify(stopsPayload(initialStops));
    const pricesChanged = pairs.some(p => prices[fareKey(p)] !== originalPrices[fareKey(p)]);
    if (!metaChanged && !stopsChanged && !pricesChanged) return onClose();

    if (stopsChanged || pricesChanged) {
      const pricing = { fares: faresPayload(pairs, prices), expectedPricingRevision: loadedTable.pricingRevision };
      const result = stopsChanged
        ? await updateOwnerTripLineStops(line.ownerId, line.id, stopsPayload(editStops), { notify: false }, pricing)
        : await saveLineFares(line.ownerId, line.id, pricing, { notify: false });
      if (!result.ok) {
        toast.error(t("common.error.somethingWentWrong"), { description: result.message, duration: 6000 });
        return setError(validation.failure(result));
      }
      queryClient.invalidateQueries();
      setLoadedTable({ ...loadedTable, pricingRevision: loadedTable.pricingRevision + 1 });
      setOriginalPrices(prices);
    }

    if (metaChanged) {
      const result = await updateOwnerTripLine(line.ownerId, line.id, { name: name.trim(), code: nextCode, isActive }, { notify: false });
      if (!result.ok) {
        toast.error(t("common.error.somethingWentWrong"), { description: result.message, duration: 6000 });
        return setError(validation.failure(result));
      }
      applyMutationCache(queryClient, tripLineImpact(line.ownerId, line, "update"), result);
    }
    toast.success(t("tripLines.toast.saved"));
    onClose();
  }

  return (
    <Dialog validation={validation} open onOpenChange={(open) => { if (!open) onClose(); }} title={t("tripLines.metaDialog.title")} description={t("tripLines.metaDialog.description")} size="lg">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("tripLines.metaDialog.nameLabel")}</span>
            <Input fieldName="name" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("tripLines.metaDialog.codeLabel")}</span>
            <Input fieldName="code" dir="auto" value={code} onChange={(event) => setCode(event.target.value)} />
            <small className="mt-1 block text-xs text-[#687886]">{t("tripLines.metaDialog.codeFixedHint")}</small>
          </label>
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-[#d8e4ec] bg-[#f8fbfd] px-3 py-2 text-sm font-bold text-[#334454]">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="size-4" />
          {t("tripLines.metaDialog.activeLabel")}
        </label>
        <div className="border-t border-[#e4ecf2] pt-4">
          <h3 className="font-extrabold text-[#00134c]">{t("tripLines.detail.routeTitle")}</h3>
          <p className="mt-0.5 text-xs text-[#687886]">{t("tripLines.stopsDialog.description")}</p>
        </div>
        <div className="flex gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-[#dbe7ee]">
          <Select fieldName="stops" aria-label={t("tripLines.stopsDialog.pickStop")} value={pick} onChange={(event) => setPick(event.target.value)} className="select-field min-w-0 flex-1 border-0 bg-transparent">
            <option value="">{t("tripLines.stopsDialog.pickStopTo")}…</option>
            {remaining.map((stop) => <option key={stop.id} value={stop.id}>{stop.name} · {stop.address || stop.governorate?.nameAr}</option>)}
          </Select>
          <Button type="button" variant="secondary" onClick={addStop} disabled={!pick}><Plus className="size-4" /> {t("common.actions.add")}</Button>
        </div>
        {editStops.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#b9d2e3] bg-[#f8fbfd] px-5 py-9 text-center">
            <MapPin className="mx-auto mb-2 size-7 text-[#059ff8]" />
            <p className="font-bold text-[#334454]">{t("tripLines.stopsDialog.emptyHint")}</p>
          </div>
        ) : (
          <ol className="space-y-0">
            {editStops.map((item, index) => (
              <li key={item.key} className="flex gap-3">
                <div className="flex w-8 shrink-0 flex-col items-center">
                  <span className={`grid size-8 place-items-center rounded-full text-xs font-extrabold ${index === 0 ? "bg-[#00134c] text-white" : index === editStops.length - 1 ? "bg-[#059ff8] text-white" : "bg-[#d6eeff] text-[#00134c]"}`}>{index + 1}</span>
                  {index < editStops.length - 1 && <span className="my-1 min-h-5 flex-1 border-r-2 border-dashed border-[#9dc2da]" />}
                </div>
                <div className="mb-2 flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-[#dbe7ee]">
                  <MapPin className="size-4 shrink-0 text-[#059ff8]" />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{item.stop.name}</strong>
                    <small className="block truncate text-xs text-[#687886]">{item.stop.address || item.stop.governorate?.nameAr}</small>
                  </span>
                  <Select
                    aria-label={t("tripLines.stopsDialog.stopTypeLabel")}
                    fieldName={`stops.${index}.stopType`} value={item.stopType}
                    onChange={(event) => setEditStops((items) => items.map((entry, entryIndex) => (entryIndex === index ? { ...entry, stopType: event.target.value as StopUse } : entry)))}
                    className="select-field w-24 shrink-0 py-2 text-xs sm:w-28"
                  >
                    <option value="BOARDING">{t("enums.stopUse.boarding")}</option>
                    <option value="LANDING">{t("enums.stopUse.landing")}</option>
                  </Select>
                  <div className="flex shrink-0">
                    <Button type="button" variant="ghost" size="icon" aria-label={t("tripLines.stopsDialog.moveUp")} onClick={() => move(index, -1)} disabled={index === 0}><ArrowUp /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={t("tripLines.stopsDialog.moveDown")} onClick={() => move(index, 1)} disabled={index === editStops.length - 1}><ArrowDown /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={t("common.actions.delete")} onClick={() => removeRow(index)}><Trash2 /></Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
        <div className="rounded-2xl bg-[#00134c] p-4 text-white">
          <span className="text-xs text-[#9ed0f0]">{t("tripLines.stopsDialog.summary")}</span>
          <br />
          <strong>{editStops.length >= 2 ? `${editStops[0].stop.name} ← ${editStops[editStops.length - 1].stop.name}` : t("tripLines.incomplete")}</strong>
        </div>
        {faresLoading ? <p role="status">{t("pricing.loading")}</p> : loadedTable ? <FareMatrix pairs={pairs} prices={prices} onChange={setPrices} /> : <p role="alert">{faresError?.message ?? t("pricing.loadFailed")}</p>}
        <AsyncButton variant="secondary" onClick={async () => {
          const [result, latestLine] = await Promise.all([fetchLineFares(line.ownerId, line.id), fetchOwnerTripLine(line.ownerId, line.id)]);
          if (!latestLine.ok) return setError(latestLine.message);
          const latestStops = editableStops(latestLine.data);
          setInitialStops(latestStops); setEditStops(latestStops); setName(latestLine.data.name); setCode(latestLine.data.code ?? ""); setIsActive(latestLine.data.isActive);
          if (!result.ok) return setError(result.message);
          const values = Object.fromEntries(result.data.fares.map(f => [fareKey(f), f.unitFare]));
          setLoadedTable(result.data); setOriginalPrices(values); setPrices(values); setError(null);
        }}>{t("pricing.refresh")}</AsyncButton>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <p className="text-xs text-[#687886]">{t("tripLines.stopsDialog.saveHint")}</p>
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>{t("common.actions.cancel")}</Button>
          <AsyncButton onClick={saveAll} disabled={!loadedTable || faresLoading}>{t("common.actions.saveChanges")}</AsyncButton>
        </div>
      </div>
    </Dialog>
  );
}
