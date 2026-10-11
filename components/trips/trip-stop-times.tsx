"use client";

import { Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StopMinutesInput } from "@/components/trip-lines/stop-minutes-input";
import { t } from "@/lib/i18n/t";
import { stopTimesInOrder } from "@/lib/schemas/p1";
import { cairoInputToIso } from "@/lib/trip-edit-time";

/** One stop of a trip as the editor needs it: the default minutes it falls back to. */
export type ScheduleStop = {
  stopOrder: number;
  name: string;
  /** Minutes after departure the stop currently has (line or trip copy). */
  defaultMinutes: number | null;
};

/** Edited minutes keyed by stopOrder; a missing key keeps the default. */
export type StopMinutes = Record<number, number | undefined>;

export function minutesFor(stop: ScheduleStop, edited: StopMinutes): number | undefined {
  return stop.stopOrder in edited ? edited[stop.stopOrder] : (stop.defaultMinutes ?? undefined);
}

/**
 * The API's per-trip override: only stops whose minutes differ from their
 * default, so an untouched schedule sends nothing and keeps following the line.
 */
export function stopTimesPayload(stops: ScheduleStop[], edited: StopMinutes) {
  const changed = stops.flatMap((stop) => {
    const minutes = minutesFor(stop, edited);
    return minutes !== undefined && minutes !== stop.defaultMinutes ? [{ stopOrder: stop.stopOrder, estimatedStopMinutes: minutes }] : [];
  });
  return changed.length ? changed : undefined;
}

/** Field error for the whole schedule, mirroring the API rule. */
export function stopTimesError(stops: ScheduleStop[], edited: StopMinutes): string | undefined {
  if (stops.length === 0 || stopTimesPayload(stops, edited) === undefined) return undefined;
  const minutes = stops.map((stop) => minutesFor(stop, edited));
  if (minutes.some((value) => value === undefined || !Number.isInteger(value) || value < 0)) return t("validation.stopMinutes");
  return stopTimesInOrder(minutes as number[]) ? undefined : t("validation.stopMinutesOrder");
}

/** Clock time the bus is due at a stop, from a datetime-local departure. */
function dueAt(departAt: string, minutes: number | undefined): string | null {
  const start = new Date(cairoInputToIso(departAt));
  if (!departAt || Number.isNaN(start.getTime()) || minutes === undefined) return null;
  return new Date(start.getTime() + minutes * 60_000).toLocaleString("ar-EG", { timeZone: "Africa/Cairo", weekday: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * Stop-by-stop schedule for one trip: each stop's minutes after departure and
 * the resulting clock time. Editing a value overrides it for this trip only.
 */
export function TripStopTimes({
  stops,
  departAt,
  edited,
  onChange,
  disabled,
}: {
  stops: ScheduleStop[];
  departAt: string;
  edited: StopMinutes;
  onChange: (next: StopMinutes) => void;
  disabled?: boolean;
}) {
  if (stops.length === 0) return <p className="text-xs text-[#687886]">{t("trips.stopTimes.pickLineFirst")}</p>;
  const customized = stopTimesPayload(stops, edited) !== undefined;
  return (
    <section className="rounded-2xl border border-[#dce8ef] bg-[#f8fbfd] p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-[#00134c]"><Clock className="size-4" />{t("trips.stopTimes.title")}</h3>
          <p className="mt-0.5 text-xs text-[#687886]">{t("trips.stopTimes.hint")}</p>
        </div>
        {customized && !disabled ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({})}><RotateCcw className="size-3.5" />{t("trips.stopTimes.reset")}</Button>
        ) : null}
      </div>
      <ol className="space-y-1.5">
        {stops.map((stop, index) => {
          const minutes = minutesFor(stop, edited);
          return (
            <li key={stop.stopOrder} className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-[#dbe7ee]">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#d6eeff] text-[11px] font-extrabold text-[#00134c]">{index + 1}</span>
              <strong className="min-w-0 flex-1 truncate text-sm">{stop.name}</strong>
              <span className="shrink-0 text-xs font-bold text-[#059ff8]">{dueAt(departAt, minutes) ?? t("trips.stopTimes.noTime")}</span>
              <fieldset disabled={disabled}>
                <StopMinutesInput fieldPrefix="stopTimes" index={index} value={minutes} onChange={(next) => onChange({ ...edited, [stop.stopOrder]: next })} />
              </fieldset>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[11px] text-[#687886]">{customized ? t("trips.stopTimes.custom") : t("trips.stopTimes.fromLine")}</p>
    </section>
  );
}
