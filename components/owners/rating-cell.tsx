"use client";

import { Star } from "lucide-react";
import { t } from "@/lib/i18n/t";

/**
 * Star rating cell. Averages are computed from non-null ratings only, so a
 * missing average means "nobody rated this yet" — that is a distinct, clearly
 * labelled state, never a zero.
 */
export function RatingCell({ value, max = 5 }: { value: number | null | undefined; max?: number }) {
  if (value === null || value === undefined) {
    return <span className="text-[#909090]">{t("common.rating.unrated")}</span>;
  }
  const rounded = Math.round(value * 10) / 10;
  return (
    <span dir="ltr" className="inline-flex items-center gap-1 font-semibold">
      <Star className="size-4 fill-[#f5a623] text-[#f5a623]" aria-hidden="true" />
      <span>
        {rounded}/{max}
      </span>
    </span>
  );
}

/** Inline card summary of an average, with the vote count when known. */
export function RatingSummary({
  value,
  count,
}: {
  value: number | null | undefined;
  count?: number;
}) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <RatingCell value={value} />
      {count !== undefined ? (
        <span className="text-xs text-[#606060]">
          {t("common.rating.votes", { count: String(count) })}
        </span>
      ) : null}
    </div>
  );
}
