import { apiGet, type ActionResult } from "@/lib/actions/http";

/**
 * Owner-company KPI insights (`GET /fleet-owners/insights` — staff reads another
 * owner's company, so every call MUST carry `x-owner-id`; apiGet does that from
 * the ownerId argument). Money values are decimal STRINGS from the backend:
 * format them for display, never compute on them.
 */

export type RatingInsight = {
  average: number | null;
  count: number;
};

export type OwnerInsights = {
  period: { from: string | null; to: string | null };
  trips: { completed: number; cancelled: number; upcoming: number };
  bookings: { confirmed: number; cancelled: number; seatsSold: number };
  revenue: { total: string; collected: string; pending: string };
  ratings: { bus: RatingInsight; driver: RatingInsight };
};

export type InsightsPeriod = { kind: "all" } | { kind: "range"; from: string; to: string };

/**
 * Query string for one period: all time → `?period=all`, a Cairo-day range →
 * `?from=YYYY-MM-DD&to=YYYY-MM-DD` (inclusive, `to >= from` — the backend
 * rejects anything else with INVALID_INSIGHTS_PERIOD).
 */
export function insightsQuery(period: InsightsPeriod): string {
  const params = new URLSearchParams();
  if (period.kind === "all") {
    params.set("period", "all");
  } else {
    params.set("from", period.from);
    params.set("to", period.to);
  }
  return `?${params.toString()}`;
}

export function fetchOwnerInsights(
  ownerId: string,
  period: InsightsPeriod,
): Promise<ActionResult<OwnerInsights>> {
  return apiGet<OwnerInsights>(`/api/fleet-owners/insights${insightsQuery(period)}`, ownerId);
}
