import { fetchAdminBookingsPage, type AdminBookingFilterParams, type AdminBookingListItem } from "@/lib/actions/bookings";
import { fetchAdminBookingOrder, type AdminBookingOrder } from "@/lib/actions/booking-orders";
import { mapWithConcurrency, type ActionResult, type CursorPage } from "@/lib/actions/http";
import { bookingOrderPaymentStatus, bookingOrderStatus } from "@/lib/booking-order-status";
import { t } from "@/lib/i18n/t";

export type AdminBookingSummary = Pick<AdminBookingListItem,
  "id" | "ownerId" | "fleetName" | "tripId" | "passengerName" | "passengerPhone" |
  "originName" | "destinationName" | "tripDepartureTime" | "createdAt" | "paymentMethod" | "totalAmount"
> & {
  orderId: string | null;
  seats: number;
  status: string;
  paymentStatus: string | null;
  hasReports: boolean | null;
  /** Complete child identity set and report evidence, never seat-count arithmetic. */
  bookingIds: string[];
  reportEvidence: { id: string; hasReports: boolean }[];
};

function hasReports(ids: string[], evidence: AdminBookingSummary["reportEvidence"]): boolean | null {
  if (evidence.some((row) => row.hasReports)) return true;
  const checked = new Set(evidence.map((row) => row.id));
  return ids.every((id) => checked.has(id)) ? false : null;
}

/** Root totals come from the saved checkout, even if a filter matches one seat. */
function summary(rows: AdminBookingListItem[], order?: AdminBookingOrder): AdminBookingSummary {
  const first = rows[0];
  const evidence = rows.map(({ id, hasReports }) => ({ id, hasReports }));
  const bookingIds = order ? order.bookings.map((booking) => booking.id) : [first.id];
  return {
    id: order?.id ?? first.id,
    orderId: order?.id ?? null,
    ownerId: first.ownerId,
    fleetName: first.fleetName,
    tripId: order?.tripId ?? first.tripId,
    passengerName: order
      ? [...new Set(order.bookings.map((booking) => booking.passengerName).filter(Boolean))].join(t("common.listSeparator"))
      : first.passengerName,
    passengerPhone: order
      ? [...new Set(order.bookings.map((booking) => booking.passengerPhone).filter(Boolean))].join(t("common.listSeparator")) || null
      : first.passengerPhone,
    originName: first.originName,
    destinationName: first.destinationName,
    tripDepartureTime: first.tripDepartureTime,
    createdAt: order?.createdAt ?? first.createdAt,
    paymentMethod: order?.paymentMethod ?? first.paymentMethod,
    totalAmount: order?.totalAmount ?? first.totalAmount,
    seats: order?.totalSeats ?? first.pricedSeatCount ?? first.seats,
    status: order ? bookingOrderStatus(order) : first.status,
    paymentStatus: order ? bookingOrderPaymentStatus(order) : first.paymentStatus,
    bookingIds,
    reportEvidence: evidence,
    hasReports: hasReports(bookingIds, evidence),
  };
}

async function readOrder(id: string): Promise<AdminBookingOrder> {
  const result = await fetchAdminBookingOrder(id);
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

/**
 * The staff API lists operational seat rows. Hydrate each distinct parent once
 * and preserve its upstream cursor; mergeBookingSummaryPages removes duplicates
 * across cursor boundaries without guessing totals from a partial child page.
 */
export async function fetchAdminBookingSummariesPage(
  filters: AdminBookingFilterParams = {},
  cursor: string | null = null,
  loadOrder: (id: string) => Promise<AdminBookingOrder> = readOrder,
): Promise<ActionResult<CursorPage<AdminBookingSummary>>> {
  // Aggregate states (PARTIALLY_CANCELLED/MIXED) are not child filter values.
  const { status, paymentStatus, createdFrom, createdTo, ...sourceFilters } = filters;
  const page = await fetchAdminBookingsPage(sourceFilters, cursor);
  if (!page.ok) return page;
  const groups = new Map<string, AdminBookingListItem[]>();
  for (const row of page.data.items) {
    const key = row.orderId ? `order:${row.orderId}` : `booking:${row.id}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  const items = await mapWithConcurrency([...groups.values()], 3, async (rows) =>
    summary(rows, rows[0].orderId ? await loadOrder(rows[0].orderId) : undefined));
  return {
    ok: true,
    data: {
      items: items.filter((row) => (!status || status === "all" || row.status === status) &&
        (!paymentStatus || paymentStatus === "all" || row.paymentStatus === paymentStatus) &&
        (!createdFrom || new Date(row.createdAt) >= new Date(createdFrom)) &&
        (!createdTo || new Date(row.createdAt) <= new Date(createdTo))),
      nextCursor: page.data.nextCursor,
    },
  };
}

export function mergeBookingSummaryPages(pages: readonly CursorPage<AdminBookingSummary>[]): AdminBookingSummary[] {
  const rows = new Map<string, AdminBookingSummary>();
  for (const page of pages) {
    for (const row of page.items) {
      const previous = rows.get(row.id);
      if (!previous) { rows.set(row.id, row); continue; }
      const evidence = [...new Map([...previous.reportEvidence, ...row.reportEvidence].map((entry) => [entry.id, entry])).values()];
      rows.set(row.id, { ...row, reportEvidence: evidence, hasReports: hasReports(row.bookingIds, evidence) });
    }
  }
  return [...rows.values()];
}
