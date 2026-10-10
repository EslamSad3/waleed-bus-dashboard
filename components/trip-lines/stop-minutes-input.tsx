"use client";

import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n/t";

/**
 * Minutes after departure that the bus is due at one stop — the line's
 * schedule. An empty box is `undefined`, which validation reports.
 */
export function StopMinutesInput({
  index,
  value,
  onChange,
  fieldPrefix = "stops",
}: {
  index: number;
  value: number | undefined;
  onChange: (minutes: number | undefined) => void;
  fieldPrefix?: string;
}) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-xs text-[#687886]">
      <Input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        dir="ltr"
        aria-label={t("tripLines.stopsDialog.minutesLabel")}
        fieldName={`${fieldPrefix}.${index}.estimatedStopMinutes`}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
        className="w-20 py-2 text-xs"
      />
      <span className="hidden sm:inline">{t("tripLines.stopsDialog.minutesLabel")}</span>
    </label>
  );
}
