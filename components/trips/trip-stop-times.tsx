"use client";

import { Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ValidationMessage } from "@/components/ui/field-validation";
import { t } from "@/lib/i18n/t";
import { cairoInputToIso, toLocalDateTimeInput } from "@/lib/trip-edit-time";

/** One stop of a trip as the editor needs it. */
export type ScheduleStop = {
  stopOrder: number;
  name: string;
  /** The time saved for this stop (ISO); null for a new trip or a stop without one. */
  scheduledAt: string | null;
};

/** Edited stop times keyed by stopOrder, as Cairo datetime-local values. */
export type StopTimes = Record<number, string | undefined>;

export type StopTimeInput = { stopOrder: number; scheduledAt: string };

const parse = (value: string) => Date.parse(cairoInputToIso(value));

/**
 * The Cairo datetime-local value shown for a stop: the first stop is the
 * departure; otherwise the operator's edit, or the saved time moved by as much
 * as the departure moved (the API shifts every stop the same way).
 */
export function stopValue(stop: ScheduleStop, index: number, edited: StopTimes, departAt: string, originalDepartAt?: string): string {
  if (index === 0) return departAt;
  if (stop.stopOrder in edited) return edited[stop.stopOrder] ?? "";
  if (!stop.scheduledAt) return "";
  const shift = originalDepartAt && departAt ? parse(departAt) - Date.parse(originalDepartAt) : 0;
  return toLocalDateTimeInput(new Date(Date.parse(stop.scheduledAt) + (Number.isNaN(shift) ? 0 : shift)).toISOString());
}

/** New trip: the time of every stop after the first (the first is the departure). */
export function allStopTimes(stops: ScheduleStop[], edited: StopTimes, departAt: string): StopTimeInput[] {
  return stops.slice(1).map((stop, i) => ({ stopOrder: stop.stopOrder, scheduledAt: cairoInputToIso(stopValue(stop, i + 1, edited, departAt)) }));
}

/** Existing trip: only the stops the operator changed (the API shifts the rest with the departure). */
export function changedStopTimes(stops: ScheduleStop[], edited: StopTimes, departAt: string, originalDepartAt: string): StopTimeInput[] | undefined {
  const changed = stops.flatMap((stop, index) => {
    if (index === 0 || !(stop.stopOrder in edited)) return [];
    const value = edited[stop.stopOrder] ?? "";
    const untouched = stopValue(stop, index, {}, departAt, originalDepartAt);
    return value && value !== untouched ? [{ stopOrder: stop.stopOrder, scheduledAt: cairoInputToIso(value) }] : [];
  });
  return changed.length ? changed : undefined;
}

/** Index of each stop whose time is before the departure or the stop ahead of it. */
function outOfOrder(values: string[]): Set<number> {
  const invalid = new Set<number>();
  let previous = parse(values[0] ?? "");
  values.forEach((value, index) => {
    if (index === 0 || !value) return;
    const at = parse(value);
    if (Number.isNaN(at) || (!Number.isNaN(previous) && at < previous)) invalid.add(index);
    else previous = at;
  });
  return invalid;
}

/**
 * Field error for the whole schedule, mirroring the API: every stop needs a
 * time when the trip is new or when any stop time is being changed, and no
 * stop is before the departure or the stop ahead of it.
 */
export function stopTimesError(stops: ScheduleStop[], edited: StopTimes, departAt: string, originalDepartAt?: string): string | undefined {
  if (stops.length === 0 || Number.isNaN(parse(departAt))) return undefined;
  const values = stops.map((stop, index) => stopValue(stop, index, edited, departAt, originalDepartAt));
  const required = !originalDepartAt || Object.keys(edited).length > 0;
  if (required && values.some((value) => !value)) return t("trips.stopTimes.missingTime");
  return outOfOrder(values).size ? t("trips.stopTimes.orderError") : undefined;
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
 * or before the stop ahead of it. Pass `originalDepartAt` when editing an
 * existing trip so saved times follow a moved departure.
 */
export function TripStopTimes({
  stops,
  departAt,
  originalDepartAt,
  edited,
  onChange,
  disabled,
}: {
  stops: ScheduleStop[];
  departAt: string;
  originalDepartAt?: string;
  edited: StopTimes;
  onChange: (next: StopTimes) => void;
  disabled?: boolean;
}) {
  if (stops.length === 0) return <p className="text-xs text-[#687886]">{t("trips.stopTimes.pickLineFirst")}</p>;
  const hasDeparture = !Number.isNaN(parse(departAt));
  const values = stops.map((stop, index) => stopValue(stop, index, edited, departAt, originalDepartAt));
  const invalid = hasDeparture ? outOfOrder(values) : new Set<number>();
  const changed = Object.keys(edited).length > 0;
  return (
    <section className="rounded-2xl border border-[#dce8ef] bg-[#f8fbfd] p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-[#00134c]"><Clock className="size-4" />{t("trips.stopTimes.title")}</h3>
          <p className="mt-0.5 text-xs text-[#687886]">{hasDeparture ? t("trips.stopTimes.hint") : t("trips.stopTimes.pickDepartureFirst")}</p>
        </div>
        {changed && originalDepartAt && !disabled ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({})}><RotateCcw className="size-3.5" />{t("trips.stopTimes.reset")}</Button>
        ) : null}
      </div>
      <ol className="space-y-1.5">
        {stops.map((stop, index) => {
          const value = values[index];
          const minutes = hasDeparture && value ? Math.round((parse(value) - parse(departAt)) / 60_000) : NaN;
          const previous = values.slice(0, index).reverse().find(Boolean) ?? departAt;
          return (
            <li key={stop.stopOrder} className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-[#dbe7ee]">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#d6eeff] text-[11px] font-extrabold text-[#00134c]">{index + 1}</span>
              <strong className="min-w-0 flex-1 truncate text-sm">{stop.name}</strong>
              {index === 0 ? (
                <span className="shrink-0 rounded-lg bg-[#eaf6ff] px-2.5 py-1.5 text-xs font-bold text-[#00134c]" dir="ltr">
                  {hasDeparture ? departAt.replace("T", "  ") : "—"}
                  <span className="ms-2 font-semibold text-[#059ff8]" dir="rtl">{t("trips.stopTimes.departure")}</span>
                </span>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  {Number.isFinite(minutes) && minutes >= 0 ? <span className="text-[11px] text-[#687886]">{durationLabel(minutes)}</span> : null}
                  <fieldset disabled={disabled || !hasDeparture}>
                    <Input
                      type="datetime-local"
                      dir="ltr"
                      aria-label={t("trips.stopTimes.stopTimeLabel", { stop: stop.name })}
                      aria-invalid={invalid.has(index) ? true : undefined}
                      min={previous || undefined}
                      value={value}
                      onChange={(event) => onChange({ ...edited, [stop.stopOrder]: event.target.value })}
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
    </section>
  );
}
