"use client";

import { useMemo } from "react";
import type { AdminBookingFilterParams } from "@/lib/actions/bookings";
import { fetchAdminBookingOrder } from "@/lib/actions/booking-orders";
import { fetchAdminBookingSummariesPage, mergeBookingSummaryPages } from "@/lib/actions/booking-summaries";
import { qk, useApiInfiniteQuery, useQueryClient } from "@/lib/queries";

/** One cache contract for the bookings grid, owner view and overview counts. */
export function useBookingSummaries(filters: AdminBookingFilterParams, options: { enabled?: boolean } = {}) {
  const client = useQueryClient();
  const query = useApiInfiniteQuery(
    qk.adminBookingsParams({ ...filters, view: "booking-summaries" }),
    (cursor) => fetchAdminBookingSummariesPage(filters, cursor, (id) => client.fetchQuery({
      queryKey: qk.bookingOrder(id),
      queryFn: async () => {
        const result = await fetchAdminBookingOrder(id);
        if (!result.ok) throw new Error(result.message);
        return result.data;
      },
    })),
    options,
  );
  const items = useMemo(() => mergeBookingSummaryPages(query.data?.pages ?? []), [query.data]);
  return { ...query, items, nextCursor: query.data?.pages.at(-1)?.nextCursor ?? null };
}
