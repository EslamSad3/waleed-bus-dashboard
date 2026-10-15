import { apiGet, apiSend, type ActionResult } from "@/lib/actions/http";
import { notifyResult } from "@/lib/actions/toast";
import type {
  QuoteStaffBookingOrderInput,
  CreateStaffBookingOrderInput,
} from "@/lib/schemas/p1";
import { t } from "@/lib/i18n/t";

/**
 * Staff grouped bookings (`POST /admin/booking-orders*`): platform staff check
 * out several passengers on one trip in a single atomic order, the same way a
 * passenger checks out in the app. The quote previews the combined price
 * without reserving seats; the create carries the quoted total plus an
 * idempotency key so a retried submit never double-books.
 */

export type BookingOrderQuoteItem = {
  boardingStationId: string;
  landingStationId: string;
  seatCount: number;
  unitFare: string;
  subtotalAmount: string;
  discountAmount: string;
  totalAmount: string;
  pricingRevision?: number | null;
};

export type BookingOrderQuote = {
  tripId: string;
  currency: string;
  items: BookingOrderQuoteItem[];
  totalSeats: number;
  subtotalAmount: string;
  discountAmount: string;
  totalAmount: string;
  promoCode?: string | null;
  promoStatus?: string | null;
};

export type BookingOrderChild = {
  id: string;
  passengerName: string;
  passengerPhone?: string | null;
  additionalPhone?: string | null;
  passengerUserId?: string | null;
  seats: number;
  status: string;
  paymentStatus?: string | null;
  totalAmount?: string | null;
  discountAmount: string;
  orderId?: string | null;
  boardingStationId?: string | null;
  landingStationId?: string | null;
  unitFareSnapshot?: string | null;
  trip?: {
    id: string;
    departureTime?: string | null;
    originName?: string | null;
    destinationName?: string | null;
  } | null;
};

export type AdminBookingOrder = {
  id: string;
  tripId: string;
  paymentMethod: string;
  totalSeats: number;
  subtotalAmount: string;
  discountAmount: string;
  totalAmount: string;
  promoCode?: string | null;
  createdAt: string;
  bookedByUserId?: string | null;
  bookings: BookingOrderChild[];
};

/** Price preview only — no seats are reserved, so no toast here (see quoteTrip). */
export function quoteStaffBookingOrder(
  input: QuoteStaffBookingOrderInput,
): Promise<ActionResult<BookingOrderQuote>> {
  return apiSend<BookingOrderQuote>("/api/admin/booking-orders/quote", "POST", input);
}

export function createStaffBookingOrder(
  input: CreateStaffBookingOrderInput,
): Promise<ActionResult<AdminBookingOrder>> {
  return notifyResult(
    t("bookings.groupOrder.toast.created"),
    apiSend<AdminBookingOrder>("/api/admin/booking-orders", "POST", input),
  );
}

export function fetchAdminBookingOrder(id: string): Promise<ActionResult<AdminBookingOrder>> {
  return apiGet<AdminBookingOrder>(`/api/admin/booking-orders/${id}`);
}
