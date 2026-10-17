"use client";

import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { RatingCell } from "@/components/owners/rating-cell";
import { KpiCardsSkeleton } from "@/components/ui/skeletons";
import { fetchOwnerInsights, insightsQuery, type InsightsPeriod, type RatingInsight } from "@/lib/actions/insights";
import { qk, useApiQuery } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

// Latin digits so money matches the plain count cards beside it (dir="ltr").
const moneyFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Backend money arrives as a decimal STRING — format it, never compute on it. */
function moneyLabel(value: string): string {
  const parsed = Number(value);
  return `${moneyFormatter.format(Number.isFinite(parsed) ? parsed : 0)} ${t("owners.insights.currency")}`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-[#00134c]" dir="ltr">
        {value}
      </p>
    </div>
  );
}

function RatingCard({ label, rating }: { label: string; rating: RatingInsight }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <RatingCell value={rating.average} />
        <span className="text-xs text-slate-400">
          ({t("common.rating.votes", { count: rating.count })})
        </span>
      </div>
    </div>
  );
}

/**
 * KPI panel for one owner company (`GET /fleet-owners/insights`): trips,
 * bookings, revenue and the two rating averages, with a period picker —
 * all time (default) or an inclusive from/to date range.
 */
export function OwnerInsights({ ownerId }: { ownerId: string }) {
  const [mode, setMode] = useState<"all" | "range">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // The period actually quoted to the API. UI edits stay local until the range
  // is complete and ordered (to >= from), so the panel keeps the last good
  // period instead of flickering into an error state.
  const [applied, setApplied] = useState<InsightsPeriod>({ kind: "all" });

  const pickAll = useCallback(() => {
    setMode("all");
    setApplied({ kind: "all" });
  }, []);

  const pickRangeMode = useCallback(() => setMode("range"), []);

  const rangeComplete = Boolean(from && to && to >= from);
  const rangeInvalid = mode === "range" && !rangeComplete;

  function editRange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    if (nextFrom && nextTo && nextTo >= nextFrom) {
      setApplied({ kind: "range", from: nextFrom, to: nextTo });
    }
  }

  const periodKey = insightsQuery(applied);
  const { data: insights, isPending, error } = useApiQuery(
    qk.ownerInsights(ownerId, periodKey),
    () => fetchOwnerInsights(ownerId, applied),
  );

  return (
    <section className="panel-card space-y-4 p-4 sm:p-6" aria-labelledby="owner-insights-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="owner-insights-title" className="section-title mb-0">
          {t("owners.insights.title")}
        </h2>
        <div
          role="group"
          aria-label={t("owners.insights.periodNav")}
          className="flex gap-2"
        >
          <button
            type="button"
            onClick={pickAll}
            aria-pressed={mode === "all"}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${
              mode === "all" ? "bg-[#059ff8] text-white" : "bg-white text-[#1a1a1a] hover:bg-[#d6eeff]"
            }`}
          >
            {t("owners.insights.periodAll")}
          </button>
          <button
            type="button"
            onClick={pickRangeMode}
            aria-pressed={mode === "range"}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${
              mode === "range" ? "bg-[#059ff8] text-white" : "bg-white text-[#1a1a1a] hover:bg-[#d6eeff]"
            }`}
          >
            {t("owners.insights.periodRange")}
          </button>
        </div>
      </div>

      {mode === "range" ? (
        <div className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">{t("owners.insights.from")}</span>
              <Input
                type="date"
                dir="ltr"
                value={from}
                onChange={(event) => editRange(event.target.value, to)}
                aria-label={t("owners.insights.from")}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">{t("owners.insights.to")}</span>
              <Input
                type="date"
                dir="ltr"
                value={to}
                onChange={(event) => editRange(from, event.target.value)}
                aria-label={t("owners.insights.to")}
              />
            </label>
          </div>
          {rangeInvalid ? <p className="text-sm text-red-600">{t("owners.insights.invalidRange")}</p> : null}
        </div>
      ) : null}

      {error && !insights ? (
        <p role="alert" className="text-sm text-red-600">
          {error.message}
        </p>
      ) : isPending || !insights ? (
        <KpiCardsSkeleton count={11} columns={3} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          <StatCard label={t("owners.insights.tripsCompleted")} value={String(insights.trips.completed)} />
          <StatCard label={t("owners.insights.tripsCancelled")} value={String(insights.trips.cancelled)} />
          <StatCard label={t("owners.insights.tripsUpcoming")} value={String(insights.trips.upcoming)} />
          <StatCard label={t("owners.insights.bookingsConfirmed")} value={String(insights.bookings.confirmed)} />
          <StatCard label={t("owners.insights.bookingsCancelled")} value={String(insights.bookings.cancelled)} />
          <StatCard label={t("owners.insights.seatsSold")} value={String(insights.bookings.seatsSold)} />
          <StatCard label={t("owners.insights.revenueTotal")} value={moneyLabel(insights.revenue.total)} />
          <StatCard label={t("owners.insights.revenueCollected")} value={moneyLabel(insights.revenue.collected)} />
          <StatCard label={t("owners.insights.revenuePending")} value={moneyLabel(insights.revenue.pending)} />
          <RatingCard label={t("owners.insights.ratingsBus")} rating={insights.ratings.bus} />
          <RatingCard label={t("owners.insights.ratingsDriver")} rating={insights.ratings.driver} />
        </div>
      )}
    </section>
  );
}
