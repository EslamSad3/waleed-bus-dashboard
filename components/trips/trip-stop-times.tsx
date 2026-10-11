"use client";

import { Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ValidationMessage } from "@/components/ui/field-validation";
import { t } from "@/lib/i18n/t";
import { cairoInputToIso, toLocalDateTimeInput } from "@/lib/trip-edit-time";

/** One stop of a trip as the editor needs it: the default minutes it falls back to. */
export type ScheduleStop = {
  stopOrder: number;
  name: string;
  /** Minutes after departure the stop currently has (line or trip copy). */
  defaultMinutes: number | null;
};

/** Edited minutes keyed by stopOrder; a missing key keeps the default. */
export type StopMinutes = Record<number, number | undefined>;

/**
 * Minutes after departure for one stop. The first stop IS the departure, so
 * it is always 0 — the operator never edits it.
 */
export function minutesFor(stop: ScheduleStop, edited: StopMinutes, index = -1): number | undefined {
  if (index === 0) return 0;
  return stop.stopOrder in edited ? edited[stop.stopOrder] : (stop.defaultMinutes ?? undefined);
}

/**
 * The API's per-trip override: only stops whose minutes differ from their
 * default, so an untouched schedule sends nothing and keeps following the line.
 */
export function stopTimesPayload(stops: ScheduleStop[], edited: StopMinutes) {
  const changed = stops.flatMap((stop, index) => {
    const minutes = minutesFor(stop, edited, index);
    return minutes !== undefined && minutes !== stop.defaultMinutes ? [{ stopOrder: stop.stopOrder, estimatedStopMinutes: minutes }] : [];
  });
  // Only the first stop "changed" (a line saved without its 0): nothing to override.
  if (changed.length === 1 && changed[0].stopOrder === stops[0]?.stopOrder) return undefined;
  return changed.length ? changed : undefined;
}

/** Index of each stop whose time is missing, before departure, or before the stop ahead of it. */
function invalidStops(stops: ScheduleStop[], edited: StopMinutes): Set<number> {
  const invalid = new Set<number>();
  let previous = 0;
  stops.forEach((stop, index) => {
    const minutes = minutesFor(stop, edited, index);
    if (minutes === undefined || !Number.isInteger(minutes) || minutes < previous) invalid.add(index);
    else previous = minutes;
  });
  return invalid;
}

/** Field error for the whole schedule, mirroring the API rule. */
export function stopTimesError(stops: ScheduleStop[], edited: StopMinutes): string | undefined {
  if (stops.length === 0 || stopTimesPayload(stops, edited) === undefined) return undefined;
  const missing = stops.some((stop, index) => minutesFor(stop, edited, index) === undefined);
  if (missing) return t("trips.stopTimes.missingTime");
  return invalidStops(stops, edited).size ? t("trips.stopTimes.orderError") : undefined;
}

/** datetime-local value (Cairo time) of a stop, from the departure and its minutes. */
function stopInput(departAt: string, minutes: number | undefined): string {
  const start = Date.parse(cairoInputToIso(departAt));
  if (Number.isNaN(start) || minutes === undefined) return "";
  return toLocalDateTimeInput(new Date(start + minutes * 60_000).toISOString());
}

/** Whole minutes from the departure to a datetime-local value (both Cairo time). */
function minutesBetween(departAt: string, value: string): number | undefined {
  const start = Date.parse(cairoInputToIso(departAt));
  const at = Date.parse(cairoInputToIso(value));
  if (Number.isNaN(start) || Number.isNaN(at)) return undefined;
  return Math.round((at - start) / 60_000);
}

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return t("trips.stopTimes.afterMinutes", { minutes: String(rest) });
  if (!rest) return t("trips.stopTimes.afterHours", { hours: String(hours) });
  return t("trips.stopTimes.afterHoursMinutes", { hours: String(hours), minutes: String(rest) });
}

/**
 * Stop-by-stop schedule for one trip. The first stop is the departure; every
 * other stop takes its own date and time, which can't be before the departure
 * or before the stop ahead of it. Times are sent to the API as minutes after
 * departure, overriding the line's schedule for this trip only.
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
  const hasDeparture = !Number.isNaN(Date.parse(cairoInputToIso(departAt)));
  const invalid = hasDeparture ? invalidStops(stops, edited) : new Set<number>();
  return (
    <section className="rounded-2xl border border-[#dce8ef] bg-[#f8fbfd] p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-[#00134c]"><Clock className="size-4" />{t("trips.stopTimes.title")}</h3>
          <p className="mt-0.5 text-xs text-[#687886]">{hasDeparture ? t("trips.stopTimes.hint") : t("trips.stopTimes.pickDepartureFirst")}</p>
        </div>
        {customized && !disabled ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({})}><RotateCcw className="size-3.5" />{t("trips.stopTimes.reset")}</Button>
        ) : null}
      </div>
      <ol className="space-y-1.5">
        {stops.map((stop, index) => {
          const minutes = minutesFor(stop, edited, index);
          const previousAt = index > 0 ? stopInput(departAt, minutesFor(stops[index - 1], edited, index - 1)) : "";
          return (
            <li key={stop.stopOrder} className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-[#dbe7ee]">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#d6eeff] text-[11px] font-extrabold text-[#00134c]">{index + 1}</span>
              <strong className="min-w-0 flex-1 truncate text-sm">{stop.name}</strong>
              {index === 0 ? (
                <span className="shrink-0 rounded-lg bg-[#eaf6ff] px-2.5 py-1.5 text-xs font-bold text-[#00134c]" dir="ltr">
                  {hasDeparture ? stopInput(departAt, 0).replace("T", "  ") : "—"}
                  <span className="ms-2 font-semibold text-[#059ff8]" dir="rtl">{t("trips.stopTimes.departure")}</span>
                </span>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  {hasDeparture && minutes !== undefined && minutes >= 0 ? <span className="text-[11px] text-[#687886]">{durationLabel(minutes)}</span> : null}
                  <fieldset disabled={disabled || !hasDeparture}>
                    <Input
                      type="datetime-local"
                      dir="ltr"
                      aria-label={t("trips.stopTimes.stopTimeLabel", { stop: stop.name })}
                      aria-invalid={invalid.has(index) && minutes !== undefined ? true : undefined}
                      min={previousAt || departAt || undefined}
                      value={stopInput(departAt, minutes)}
                      onChange={(event) => onChange({ ...edited, [stop.stopOrder]: event.target.value ? minutesBetween(departAt, event.target.value) : undefined })}
                      className="w-56 py-2 text-xs"
                    />
                  </fieldset>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <ValidationMessage name="stopTimes" />
      <p className="mt-2 text-[11px] text-[#687886]">{customized ? t("trips.stopTimes.custom") : t("trips.stopTimes.fromLine")}</p>
    </section>
  );
}
