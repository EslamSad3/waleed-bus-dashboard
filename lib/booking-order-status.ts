/** Match the passenger API, including historical administrative partial changes. */
export function bookingOrderStatus(order: {
  totalSeats: number;
  bookings: ReadonlyArray<{ status: string; seats: number }>;
}): "CONFIRMED" | "CANCELLED" | "PARTIALLY_CANCELLED" | "COMPLETED" {
  const { bookings, totalSeats } = order;
  if (bookings.every((b) => b.status === "CANCELLED")) return "CANCELLED";
  if (bookings.some((b) => b.status === "CANCELLED") ||
      bookings.reduce((sum, b) => sum + b.seats, 0) < totalSeats) return "PARTIALLY_CANCELLED";
  if (bookings.every((b) => b.status === "COMPLETED")) return "COMPLETED";
  return "CONFIRMED";
}
