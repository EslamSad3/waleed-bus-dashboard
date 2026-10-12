"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { BOOKING_STATUS_AR } from "@/lib/actions/bookings";
import { fetchAdminBookingOrder } from "@/lib/actions/booking-orders";
import { fetchTripPricing } from "@/lib/actions/trips";
import { qk, useApiQuery } from "@/lib/queries";
import { t as tr } from "@/lib/i18n/t";

/**
 * Grouped-order card for the booking detail page: every child booking of the
 * same staff order, with the booking being viewed highlighted. Renders straight
 * from the query cache — no local-state sync, so there is no seen-marker to seed.
 */
export function BookingOrderSection({
  orderId,
  currentBookingId,
}: {
  orderId: string;
  currentBookingId: string;
}) {
  const { data: order, isPending, error } = useApiQuery(
    qk.bookingOrder(orderId),
    () => fetchAdminBookingOrder(orderId),
  );
  const { data: pricing } = useApiQuery(
    ["trip-pricing", order?.tripId ?? "none"],
    () => fetchTripPricing(order?.tripId ?? ""),
    { enabled: Boolean(order?.tripId) },
  );

  const stationName = (id: string | null | undefined): string => {
    if (!id) return "—";
    const found = pricing?.line?.stations.find((s) => s.id === id);
    return found?.name ?? tr("common.value.idPrefix", { value: id.slice(0, 8) });
  };

  return (
    <section aria-labelledby="booking-order-title" className="panel-card space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4ecf2] pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="size-5 shrink-0 text-[#059ff8]" />
          <div className="min-w-0">
            <h2 id="booking-order-title" className="min-w-0 text-lg font-bold text-[#00134c]">{tr("bookings.detail.orderSection.title")}</h2>
            <p className="text-xs text-[#5e6b78] sm:text-sm">{tr("bookings.detail.orderSection.description")}</p>
          </div>
        </div>
        {order ? (
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="rounded-lg bg-[#f8fbfd] px-2.5 py-1 font-bold text-[#00134c]">
              {tr("bookings.detail.orderSection.totalSeats")}: {order.totalSeats} {tr("bookings.detail.orderSection.seatsUnit")}
            </span>
            <span className="rounded-lg bg-[#d6eeff] px-2.5 py-1 font-extrabold text-[#00134c]">
              {tr("bookings.detail.orderSection.orderTotal")}: <span dir="ltr">{order.totalAmount} EGP</span>
            </span>
          </div>
        ) : null}
      </div>

      {isPending ? <p role="status" className="text-sm text-[#5e6b78]">{tr("bookings.detail.orderSection.loading")}</p> : null}
      {error ? <p role="alert" className="text-sm text-red-600">{tr("bookings.detail.orderSection.loadFailed")}</p> : null}
      {order && order.bookings.length === 0 ? (
        <p className="text-sm text-[#5e6b78]">{tr("bookings.detail.orderSection.empty")}</p>
      ) : null}

      {order ? (
        <ul className="space-y-2">
          {order.bookings.map((child) => {
            const current = child.id === currentBookingId;
            return (
              <li key={child.id}>
                <Link
                  href={`/bookings/${child.id}`}
                  aria-label={tr("bookings.detail.orderSection.rowLabel", { value: child.passengerName || child.passengerPhone || "" })}
                  aria-current={current ? "true" : undefined}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm transition hover:bg-[#eaf6ff] ${
                    current ? "border-[#059ff8] bg-[#f0f8ff] ring-2 ring-[#059ff8]/30" : "border-[#e4ecf2] bg-white"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-bold text-[#1a1a1a]">
                      <span className="min-w-0 break-words">{child.passengerName}</span>
                      {current ? (
                        <span className="status-pill bg-[#059ff8] text-xs text-white">{tr("bookings.detail.orderSection.currentBadge")}</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#5e6b78]">
                      <span dir="ltr">{child.passengerPhone ?? "—"}</span>
                      {" · "}
                      <span dir="auto">{stationName(child.boardingStationId)} {tr("bookings.detail.orderSection.routeSeparator")} {stationName(child.landingStationId)}</span>
                      {" · "}
                      {child.seats} {tr("bookings.detail.orderSection.seatsUnit")}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span
                      className={
                        child.status === "CONFIRMED"
                          ? "status-pill bg-green-100 text-xs text-green-800"
                          : child.status === "CANCELLED"
                            ? "status-pill bg-red-100 text-xs text-red-800"
                            : "status-pill bg-blue-100 text-xs text-blue-800"
                      }
                    >
                      {BOOKING_STATUS_AR[child.status] ?? child.status}
                    </span>
                    <span className="font-extrabold text-[#00134c]" dir="ltr">
                      {child.totalAmount ?? "—"}{child.totalAmount ? " EGP" : ""}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
