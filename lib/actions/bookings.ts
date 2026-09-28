import { apiGet, apiSend, type ActionResult, type CursorPage } from "@/lib/actions/http";
import { notifyResult } from "@/lib/actions/toast";
import type {
  AdminVerifyPaymentInput,
  AdminFailPaymentInput,
  AdminRefundPaymentInput,
  AdminForceCancelInput,
  AdminReinstateInput,
  AdminOperationalOverrideInput,
  AdminResolveReportInput,
} from "@/lib/schemas/admin-bookings";
import type { CreateBookingInput } from "@/lib/schemas/p1";
import { t } from "@/lib/i18n/t";

export type BookingStatus = "CONFIRMED" | "CANCELLED" | "COMPLETED";

export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "REFUND_PENDING"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "FAILED"
  | "CANCELLED";

export type DropStatus = "DROPPED_OFF" | "NOT_DROPPED_OFF";

export type ReportStatus = "PENDING" | "RESOLVED" | "DISMISSED";

export const BOOKING_STATUS_AR: Record<string, string> = {
  CONFIRMED: t("enums.bookingStatus.confirmed"),
  CANCELLED: t("enums.bookingStatus.cancelled"),
  COMPLETED: t("enums.bookingStatus.completed"),
};

export const PAYMENT_STATUS_AR: Record<string, string> = {
  PENDING: t("enums.paymentStatus.pending"),
  PAID: t("enums.paymentStatus.paid"),
  REFUND_PENDING: t("enums.paymentStatus.refundPending"),
  PARTIALLY_REFUNDED: t("enums.paymentStatus.partiallyRefunded"),
  REFUNDED: t("enums.paymentStatus.refunded"),
  FAILED: t("enums.paymentStatus.failed"),
  CANCELLED: t("enums.paymentStatus.cancelled"),
};

export const PAYMENT_METHOD_AR: Record<string, string> = {
  CASH: t("enums.paymentMethod.cashAlt"),
  VODAFONE_CASH: t("enums.paymentMethod.vodafoneCash"),
  INSTAPAY: t("enums.paymentMethod.instapay"),
  WALLET: t("enums.paymentMethod.wallet"),
  CARD: t("enums.paymentMethod.bankCard"),
};

export const DROP_STATUS_AR: Record<string, string> = {
  DROPPED_OFF: t("enums.dropStatus.droppedOff"),
  NOT_DROPPED_OFF: t("enums.dropStatus.notDroppedOff"),
};

export const REPORT_STATUS_AR: Record<string, string> = {
  PENDING: t("enums.reportStatus.pending"),
  RESOLVED: t("enums.reportStatus.resolved"),
  DISMISSED: t("enums.reportStatus.dismissed"),
};

export type AdminBookingListItem = {
  id: string;
  fleetId: string;
  fleetName: string;
  tripId: string;
  passengerName: string;
  passengerPhone?: string | null;
  passengerUserId?: string | null;
  bookingFor?: string | null;
  note?: string | null;
  promoCode?: string | null;
  discountAmount?: string | null;
  seats: number;
  status: BookingStatus;
  totalAmount: string;
  refundedAmount: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  paymentReference?: string | null;
  boardedAt?: string | null;
  dropStatus?: DropStatus | null;
  hasReports: boolean;
  tripDepartureTime?: string | null;
  originName?: string | null;
  destinationName?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
};

export type PassengerProfile = {
  id: string;
  name: string;
  phoneNumber?: string | null;
  phoneVerifiedAt?: string | null;
  picture?: string | null;
  nationalId?: string | null;
};

export type TripDetails = {
  id: string;
  departureTime: string;
  originName: string;
  destinationName: string;
  fare: string;
  status: string;
  availableSeats: number;
  bus?: {
    id: string;
    registrationNumber: string;
    capacity: number;
  } | null;
  driver?: {
    id: string;
    name: string;
    phoneNumber?: string | null;
  } | null;
};

export type IncidentReport = {
  id: string;
  note: string;
  status: ReportStatus;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
};

export type BookingRatings = {
  busRating?: number | null;
  driverRating?: number | null;
  passengerRating?: number | null;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  actorUserId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type AdminBookingDetail = {
  id: string;
  fleetId: string;
  fleetName: string;
  status: BookingStatus;
  seats: number;
  passengerName?: string | null;
  passengerPhone?: string | null;
  passengerUserId?: string | null;
  bookingFor?: string | null;
  note?: string | null;
  promoCode?: string | null;
  discountAmount?: string | null;
  boardingStationId?: string | null;
  landingStationId?: string | null;
  boardingStationName?: string | null;
  landingStationName?: string | null;
  totalAmount: string;
  refundedAmount: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  paymentReference?: string | null;
  paymentNotes?: string | null;
  paidAt?: string | null;
  paymentMarkedBy?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  boardedAt?: string | null;
  boardedBy?: string | null;
  dropStatus?: DropStatus | null;
  dropStationId?: string | null;
  dropReason?: string | null;
  passenger?: PassengerProfile | null;
  trip: TripDetails;
  reports: IncidentReport[];
  ratings?: BookingRatings | null;
  auditTrail: AuditLogEntry[];
};

export type AdminBookingFilterParams = {
  cursor?: string;
  limit?: number;
  fleetId?: string;
  tripId?: string;
  passengerUserId?: string;
  passengerPhone?: string;
  passengerName?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  createdFrom?: string;
  createdTo?: string;
  departureFrom?: string;
  departureTo?: string;
  hasReports?: boolean;
};

export type AdminBookingPage = CursorPage<AdminBookingListItem>;

// Backward compat alias
export type Booking = AdminBookingListItem;
export type BookingPage = AdminBookingPage;

export function fetchAdminBookingsPage(
  filters: AdminBookingFilterParams = {},
  cursor?: string | null,
): Promise<ActionResult<AdminBookingPage>> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(filters.limit ?? 20));

  if (filters.fleetId) params.set("fleetId", filters.fleetId);
  if (filters.tripId) params.set("tripId", filters.tripId);
  if (filters.passengerUserId) params.set("passengerUserId", filters.passengerUserId);
  if (filters.passengerPhone) params.set("passengerPhone", filters.passengerPhone);
  if (filters.passengerName) params.set("passengerName", filters.passengerName);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.paymentStatus && filters.paymentStatus !== "all") {
    params.set("paymentStatus", filters.paymentStatus);
  }
  if (filters.paymentMethod && filters.paymentMethod !== "all") {
    params.set("paymentMethod", filters.paymentMethod);
  }
  if (filters.createdFrom) params.set("createdFrom", filters.createdFrom);
  if (filters.createdTo) params.set("createdTo", filters.createdTo);
  if (filters.departureFrom) params.set("departureFrom", filters.departureFrom);
  if (filters.departureTo) params.set("departureTo", filters.departureTo);
  if (filters.hasReports) params.set("hasReports", "true");

  return apiGet<AdminBookingPage>(`/api/admin/bookings?${params.toString()}`);
}

export function fetchAdminBookingDetail(id: string): Promise<ActionResult<AdminBookingDetail>> {
  return apiGet<AdminBookingDetail>(`/api/admin/bookings/${id}`);
}

export function verifyBookingPayment(
  id: string,
  input: AdminVerifyPaymentInput,
): Promise<ActionResult<{ bookingId: string; paymentStatus: string; paymentReference: string; paidAt: string }>> {
  return notifyResult(
    t("bookings.toast.paymentVerified"),
    apiSend(`/api/admin/bookings/${id}/payment/verify`, "POST", input),
  );
}

export function failBookingPayment(
  id: string,
  input: AdminFailPaymentInput,
): Promise<ActionResult<{ bookingId: string; paymentStatus: string; updatedAt: string }>> {
  return notifyResult(
    t("bookings.toast.paymentFailed"),
    apiSend(`/api/admin/bookings/${id}/payment/fail`, "POST", input),
  );
}

export function refundBookingPayment(
  id: string,
  input: AdminRefundPaymentInput,
): Promise<
  ActionResult<{
    bookingId: string;
    paymentStatus: string;
    totalAmount: string;
    refundedAmount: string;
    remainingRefundableBalance: string;
    refundReference: string;
    updatedAt: string;
  }>
> {
  return notifyResult(
    t("bookings.toast.refunded"),
    apiSend(`/api/admin/bookings/${id}/payment/refund`, "POST", input),
  );
}

export function forceCancelBooking(
  id: string,
  input: AdminForceCancelInput,
): Promise<
  ActionResult<{
    id: string;
    status: string;
    cancellationReason: string;
    cancelledAt: string;
    paymentStatus: string;
    seatsRestored: boolean;
  }>
> {
  return notifyResult(
    t("bookings.toast.cancelled"),
    apiSend(`/api/admin/bookings/${id}/cancel`, "POST", input),
  );
}

export function reinstateBooking(
  id: string,
  input: AdminReinstateInput,
): Promise<ActionResult<{ id: string; status: string; reinstatedAt: string }>> {
  return notifyResult(
    t("bookings.toast.reinstated"),
    apiSend(`/api/admin/bookings/${id}/reinstate`, "POST", input),
  );
}

export function overrideBookingOperational(
  id: string,
  input: AdminOperationalOverrideInput,
): Promise<
  ActionResult<{
    id: string;
    boardedAt?: string | null;
    dropStatus?: DropStatus | null;
    dropStationId?: string | null;
    updatedAt: string;
  }>
> {
  return notifyResult(
    t("bookings.toast.boardingUpdated"),
    apiSend(`/api/admin/bookings/${id}/operational`, "PATCH", input),
  );
}

export function resolveIncidentReport(
  bookingId: string,
  reportId: string,
  input: AdminResolveReportInput,
): Promise<ActionResult<IncidentReport>> {
  return notifyResult(
    t("bookings.toast.reportClosed"),
    apiSend(`/api/admin/bookings/${bookingId}/reports/${reportId}`, "PATCH", input),
  );
}

// Backward compatibility functions
export function fetchBookingsPage(
  fleetId: string,
  cursor: string | null,
): Promise<ActionResult<BookingPage>> {
  return fetchAdminBookingsPage({ fleetId }, cursor);
}

export function fetchBooking(
  fleetId: string,
  id: string,
): Promise<ActionResult<AdminBookingDetail>> {
  return fetchAdminBookingDetail(id);
}

export function createBooking(
  fleetId: string,
  input: CreateBookingInput,
): Promise<ActionResult<AdminBookingListItem>> {
  return notifyResult(
    t("bookings.toast.created"),
    apiSend<AdminBookingListItem>(`/api/fleet-owners/fleets/${fleetId}/bookings`, "POST", input),
  );
}

export function updateBooking(
  fleetId: string,
  id: string,
  input: { passengerName?: string; passengerPhone?: string; status?: BookingStatus },
): Promise<ActionResult<AdminBookingListItem>> {
  return notifyResult(
    t("bookings.toast.saved"),
    apiSend<AdminBookingListItem>(`/api/fleet-owners/fleets/${fleetId}/bookings/${id}`, "PATCH", input),
  );
}

export function deleteBooking(fleetId: string, id: string): Promise<ActionResult<null>> {
  return notifyResult(t("bookings.toast.deleted"), apiSend<null>(`/api/fleet-owners/fleets/${fleetId}/bookings/${id}`, "DELETE"));
}
