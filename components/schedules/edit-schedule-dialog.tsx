"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DriverPicker } from "@/components/buses/driver-picker";
import { fetchBusesPage, type Bus } from "@/lib/actions/buses";
import { updateSchedule, type TripSchedule } from "@/lib/actions/schedules";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";
import { cn } from "@/lib/utils";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function EditScheduleDialog({
  schedule,
  open,
  onClose,
  onUpdated,
}: {
  schedule: TripSchedule | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: (schedule: TripSchedule) => void;
}) {
  const queryClient = useQueryClient();
  const ownerId = schedule?.ownerId ?? "";
  const lineId = schedule?.lineId ?? "";

  const [busId, setBusId] = useState("");
  const [driverUserId, setDriverUserId] = useState("");
  const [departTime, setDepartTime] = useState("08:00");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seenSchedule, setSeenSchedule] = useState<TripSchedule | null>(null);
  if (schedule && schedule !== seenSchedule) {
    setSeenSchedule(schedule);
    setBusId(schedule.busId);
    setDriverUserId(schedule.driverUserId);
    setDepartTime(schedule.departTime);
    setSelectedDays(schedule.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6]);
    setStartsOn(schedule.startsOn ?? "");
    setEndsOn(schedule.endsOn ?? "");
    setIsActive(schedule.isActive);
    setError(null);
  }

  const { data: busesPage } = useApiQuery(
    qk.buses(ownerId || "none"),
    () => fetchBusesPage(ownerId, null),
    { enabled: open && Boolean(ownerId) },
  );

  const buses: Bus[] = useMemo(
    () => (busesPage?.items ?? []).filter((b) => b.isActive || b.id === busId),
    [busesPage, busId],
  );

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b),
    );
  }

  async function submit() {
    if (!schedule) return;
    if (selectedDays.length === 0) {
      setError(t("schedules.createDialog.daysLabel"));
      return;
    }

    setError(null);
    setSaving(true);
    const result = await updateSchedule(ownerId, lineId, schedule.id, {
      busId: busId || undefined,
      driverUserId: driverUserId || undefined,
      departTime: departTime || undefined,
      daysOfWeek: selectedDays,
      startsOn: startsOn || undefined,
      endsOn: endsOn || null,
      isActive,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["schedules"] });
    void queryClient.invalidateQueries({ queryKey: ["schedule-trips", ownerId, lineId] });
    onUpdated?.(result.data);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t("schedules.editDialog.title")}
      description={t("schedules.editDialog.description")}
      size="lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">
              {t("common.fields.bus")}
            </span>
            <Select
              value={busId}
              onChange={(e) => setBusId(e.target.value)}
              className="select-field w-full"
            >
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
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">
                {t("common.fields.status")}
              </span>
              <Select
                value={isActive ? "active" : "inactive"}
                onChange={(e) => setIsActive(e.target.value === "active")}
                className="select-field w-full"
              >
                <option value="active">{t("common.status.active")}</option>
                <option value="inactive">{t("common.status.inactive")}</option>
              </Select>
            </label>
          </div>

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

          <div className="grid gap-3 sm:grid-cols-2">
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
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" variant="success" loading={saving}>
            {saving ? t("common.loading.saving") : t("schedules.editDialog.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
