"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/t";

export type DateRange = { from: string; to: string };

type Props = {
  value: DateRange;
  onChange: (next: DateRange) => void;
  /** Days offered as one-tap shortcuts above the calendar. */
  presets?: { days: number; label: string }[];
  ariaLabel?: string;
};

const MS_DAY = 86_400_000;

/** Local-time YYYY-MM-DD. Never toISOString(): that shifts the day by timezone. */
function toKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

/**
 * One control for a date range, instead of two From/To inputs: pick a start
 * day, then an end day. Also offers day-count shortcuts, which is what an ops
 * screen actually reaches for ("last 7 days").
 *
 * Values are plain YYYY-MM-DD strings so callers can compare them against
 * `departAt.slice(0, 10)` without any parsing.
 */
export function DateRangePicker({ value, onChange, presets, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value.from ? fromKey(value.from) : new Date()));
  const [pendingEnd, setPendingEnd] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = useMemo(() => {
    if (value.from && value.to) return `${value.from} → ${value.to}`;
    if (value.from) return `${value.from} → ${t("dateRange.openEnded")}`;
    return t("dateRange.anyDate");
  }, [value.from, value.to]);

  const days = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const gridStart = new Date(first);
    // Saturday-first, matching the ar-EG week the dashboard uses elsewhere.
    gridStart.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
  }, [viewMonth]);

  function pick(date: Date) {
    const key = toKey(date);
    if (!pendingEnd || !value.from) {
      onChange({ from: key, to: "" });
      setPendingEnd(true);
      return;
    }
    const from = fromKey(value.from);
    // Tapping an earlier day starts a new range instead of producing to < from.
    if (date < from) onChange({ from: key, to: "" });
    else onChange({ from: value.from, to: key });
    setPendingEnd(false);
  }

  function applyPreset(daysBack: number) {
    const to = new Date();
    const from = new Date(to.getTime() - (daysBack - 1) * MS_DAY);
    onChange({ from: toKey(from), to: toKey(to) });
    setPendingEnd(false);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="select-field flex w-full items-center justify-between gap-2 bg-white md:w-auto md:max-w-56"
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarDays className="size-4 shrink-0 text-[#606060]" />
          <span className="truncate" dir="ltr">{label}</span>
        </span>
        {value.from || value.to ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={t("dateRange.clear")}
            onClick={(event) => {
              event.stopPropagation();
              onChange({ from: "", to: "" });
              setPendingEnd(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation();
                onChange({ from: "", to: "" });
                setPendingEnd(false);
              }
            }}
            className="rounded-full p-0.5 text-[#606060] hover:bg-[#e4ecf2]"
          >
            <X className="size-3.5" />
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute z-50 mt-2 w-[19rem] rounded-2xl border border-[#cfdce6] bg-white p-3 shadow-lg">
          {presets?.length ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <Button key={preset.days} type="button" variant="secondary" size="sm" onClick={() => applyPreset(preset.days)}>
                  {preset.label}
                </Button>
              ))}
            </div>
          ) : null}

          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label={t("dateRange.previousMonth")}
              onClick={() => setViewMonth((current) => addMonths(current, -1))}
              className="rounded-lg px-2 py-1 text-sm hover:bg-[#f1f6fa]"
            >
              ‹
            </button>
            <span className="text-sm font-bold text-[#334454]">
              {viewMonth.toLocaleDateString("ar-EG", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              aria-label={t("dateRange.nextMonth")}
              onClick={() => setViewMonth((current) => addMonths(current, 1))}
              className="rounded-lg px-2 py-1 text-sm hover:bg-[#f1f6fa]"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-[#606060]">
            {new Date(2024, 0, 6).getDay() === 0
              ? [0, 1, 2, 3, 4, 5, 6].map((day) => (
                  <span key={day} className="py-1">
                    {new Date(2024, 0, 6 + day).toLocaleDateString("ar-EG", { weekday: "narrow" })}
                  </span>
                ))
              : null}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((date) => {
              const key = toKey(date);
              const inMonth = date.getMonth() === viewMonth.getMonth();
              const isStart = key === value.from;
              const isEnd = key === value.to;
              const inRange = Boolean(value.from && value.to && key > value.from && key < value.to);
              const isToday = key === toKey(new Date());
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  aria-pressed={isStart || isEnd}
                  onClick={() => pick(date)}
                  className={cn(
                    "h-8 rounded-lg text-xs",
                    inMonth ? "text-[#1a1a1a]" : "text-[#b6c2cc]",
                    (isStart || isEnd) && "bg-[#059ff8] font-bold text-white",
                    inRange && "bg-[#d6eeff] text-[#00134c]",
                    !isStart && !isEnd && !inRange && inMonth && "hover:bg-[#eaf6ff]",
                    isToday && !isStart && !isEnd && "ring-1 ring-[#059ff8]",
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-center text-[11px] text-[#606060]">
            {pendingEnd ? t("dateRange.pickEnd") : t("dateRange.pickStart")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
