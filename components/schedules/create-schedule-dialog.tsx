"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { OwnerPicker } from "@/components/owners/owner-picker";
import { DriverPicker } from "@/components/buses/driver-picker";
import { fetchOwnerTripLinesPage, fetchOwnerTripLine, lineEndpoints, type TripLineListItem } from "@/lib/actions/trip-lines";
import { fetchBusesPage, type Bus } from "@/lib/actions/buses";
import { createSchedule, type TripSchedule } from "@/lib/actions/schedules";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";
import { cn } from "@/lib/utils";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function CreateScheduleDialog({
  open,
  onClose,
  lockedOwnerId,
  lockedLineId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  lockedOwnerId?: string;
  lockedLineId?: string;
  onCreated?: (schedule: TripSchedule) => void;
}) {
  const queryClient = useQueryClient();
  const [pickedOwnerId, setPickedOwnerId] = useState("");
  const ownerId = lockedOwnerId ?? pickedOwnerId;

  const [lineId, setLineId] = useState(lockedLineId ?? "");
  const [busId, setBusId] = useState("");
  const [driverUserId, setDriverUserId] = useState("");
  const [departTime, setDepartTime] = useState("08:00");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [startsOn, setStartsOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [endsOn, setEndsOn] = useState("");
  const [stopOffsets, setStopOffsets] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const lines: TripLineListItem[] = useMemo(() => linesPage?.items ?? [], [linesPage]);
  const buses: Bus[] = useMemo(
    () => (busesPage?.items ?? []).filter((b) => b.isActive),
    [busesPage],
  );

  const { data: selectedLine } = useApiQuery(
    qk.tripLine(ownerId || "none", lineId || "none"),
    () => fetchOwnerTripLine(ownerId, lineId),
    { enabled: open && Boolean(ownerId && lineId) },
  );

  const orderedStops = useMemo(() => {
    if (!selectedLine?.stops) return [];
    return [...selectedLine.stops].sort((a, b) => a.stopOrder - b.stopOrder);
  }, [selectedLine]);

  const getOffset = (idx: number) => {
    if (idx === 0) return 0;
    return stopOffsets[idx] ?? idx * 20;
  };

  function resetForm() {
    setPickedOwnerId("");
    setLineId(lockedLineId ?? "");
    setBusId("");
    setDriverUserId("");
    setDepartTime("08:00");
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    setStartsOn(new Date().toISOString().slice(0, 10));
    setEndsOn("");
    setStopOffsets([]);
    setError(null);
  }

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b),
    );
  }

  async function submit() {
    if (!ownerId || !lineId || !busId || !driverUserId || !departTime) {
      setError(t("common.validation.required"));
      return;
    }
    if (selectedDays.length === 0) {
      setError(t("schedules.createDialog.daysLabel"));
      return;
    }

    const offsets = orderedStops.map((_, i) => getOffset(i));

    setError(null);
    setSaving(true);
    const result = await createSchedule(ownerId, lineId, {
      busId,
      driverUserId,
      departTime,
      stopOffsetsMin: offsets,
      daysOfWeek: selectedDays,
      startsOn: startsOn || undefined,
      endsOn: endsOn || null,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["schedules"] });
    void queryClient.invalidateQueries({ queryKey: ["schedule-trips", ownerId, lineId] });
    onCreated?.(result.data);
    resetForm();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetForm();
          onClose();
        }
      }}
      title={t("schedules.createDialog.title")}
      description={t("schedules.createDialog.description")}
      size="xl"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {!lockedOwnerId && (
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
              <span className="mb-1.5 block font-bold text-[#334454]">
                {t("common.fields.tripLine")}
              </span>
              <Select
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                disabled={!ownerId || Boolean(lockedLineId)}
                className="select-field w-full"
              >
                <option value="">{t("schedules.createDialog.pickLine")}</option>
                {lines
                  .filter((l) => l.isActive)
                  .map((line) => {
                    const ends = lineEndpoints(line);
                    return (
                      <option key={line.id} value={line.id}>
                        {line.name} · {ends.origin ?? "—"} ← {ends.destination ?? "—"}
                      </option>
                    );
                  })}
              </Select>
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">
                {t("common.fields.bus")}
              </span>
              <Select
                value={busId}
                onChange={(e) => setBusId(e.target.value)}
                disabled={!ownerId}
                className="select-field w-full"
              >
                <option value="">{t("schedules.createDialog.pickBus")}</option>
                {buses.map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {bus.plateNumber ?? t("common.value.withoutName")}
                  </option>
                ))}
              </Select>
            </label>

            {ownerId && (
              <DriverPicker
                ownerId={ownerId}
                value={driverUserId}
                onChange={setDriverUserId}
              />
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block font-bold text-[#334454]">
                  {t("schedules.columns.departureTime")}
                </span>
                <Input
                  dir="ltr"
                  type="time"
                  value={departTime}
                  onChange={(e) => setDepartTime(e.target.value)}
                />
                <small className="mt-1 block text-xs text-[#687886]">
                  {t("schedules.createDialog.departureTimeHint")}
                </small>
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-bold text-[#334454]">
                  {t("schedules.dialog.startDate")}
                </span>
                <Input
                  dir="ltr"
                  type="date"
                  value={startsOn}
                  onChange={(e) => setStartsOn(e.target.value)}
                />
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">
                {t("schedules.dialog.endDate")} <span className="font-normal text-slate-400">{t("common.value.optional")}</span>
              </span>
              <Input
                dir="ltr"
                type="date"
                value={endsOn}
                onChange={(e) => setEndsOn(e.target.value)}
              />
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <span className="mb-2 block text-sm font-bold text-[#334454]">
                {t("schedules.createDialog.daysLabel")}
              </span>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {ALL_DAYS.map((day) => {
                  const isChecked = selectedDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "rounded-xl border py-2 text-center text-xs font-bold transition",
                        isChecked
                          ? "border-[#059ff8] bg-[#eaf6ff] text-[#00134c]"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                      )}
                    >
                      {t(`schedules.daysShort.${day}` as any)}
                    </button>
                  );
                })}
              </div>
            </div>

            {orderedStops.length > 0 && (
              <div>
                <span className="mb-2 block text-sm font-bold text-[#334454]">
                  {t("schedules.createDialog.stopTimesHint")}
                </span>
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  {orderedStops.map((stop, idx) => (
                    <div
                      key={stop.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-800">
                        {idx + 1}. {stop.station.name}
                      </span>
                      {idx === 0 ? (
                        <span className="text-slate-500 font-mono">{t("schedules.dialog.startStop")}</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min={getOffset(idx - 1)}
                            className="h-7 w-20 text-center font-mono text-xs"
                            value={getOffset(idx)}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setStopOffsets((prev) => {
                                const next = [...prev];
                                next[idx] = val;
                                return next;
                              });
                            }}
                          />
                          <span className="text-slate-500">{t("schedules.dialog.minute")}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" variant="success" loading={saving} disabled={!lineId || !busId || !driverUserId}>
            {saving ? t("common.loading.saving") : t("schedules.createDialog.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
