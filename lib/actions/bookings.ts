import { apiGet, apiSend, type ActionResult, type CursorPage } from "@/lib/actions/http";
import type { CreateBookingInput } from "@/lib/schemas/p1";

export type Booking = {
  id: string;
  fleetId: string;
  tripId: string;
  passengerName: string;
  passengerPhone?: string | null;
  seats: number;
  status: "CONFIRMED" | "CANCELLED";
  busRating?: number | null;
  driverRating?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type BookingPage = CursorPage<Booking>;

export const BOOKING_STATUS_AR: Record<Booking["status"], string> = {
  CONFIRMED: "مؤكد",
  CANCELLED: "ملغي",
};

export function fetchBookingsPage(fleetId: string, cursor: string | null): Promise<ActionResult<BookingPage>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<BookingPage>(`/api/fleets/${fleetId}/bookings${q}`);
}

export function fetchBooking(fleetId: string, id: string): Promise<ActionResult<Booking>> {
  return apiGet<Booking>(`/api/fleets/${fleetId}/bookings/${id}`);
}

export function createBooking(fleetId: string, input: CreateBookingInput): Promise<ActionResult<Booking>> {
  return apiSend<Booking>(`/api/fleets/${fleetId}/bookings`, "POST", input);
}

export function updateBooking(fleetId: string, id: string, input: { passengerName?: string; passengerPhone?: string; status?: Booking["status"] }): Promise<ActionResult<Booking>> {
  return apiSend<Booking>(`/api/fleets/${fleetId}/bookings/${id}`, "PATCH", input);
}

export function deleteBooking(fleetId: string, id: string): Promise<ActionResult<null>> {
  return apiSend<null>(`/api/fleets/${fleetId}/bookings/${id}`, "DELETE");
}
