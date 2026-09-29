import { apiGet, type ActionResult, type CursorPage } from "@/lib/actions/http";

/**
 * Passenger feedback reads. Passengers rate the bus and the driver SEPARATELY,
 * so every view carries both sides (either may be null) plus the driver
 * snapshotted on the trip at departure — never the current bus assignment.
 */

export type FeedbackLine = {
  id: string;
  name: string;
  code: string;
  origin: string | null;
  destination: string | null;
};

export type FeedbackBus = {
  id: string;
  registrationNumber: string;
  plateNumber: string | null;
};

export type FeedbackDriver = {
  id: string;
  name: string | null;
  nickname?: string | null;
  picture?: string | null;
};

export type FeedbackTrip = {
  id: string;
  departAt: string;
  status: string;
  line: FeedbackLine;
  bus: FeedbackBus;
  driver: FeedbackDriver | null;
  driverUserId: string | null;
};

export type RatingSide = {
  rating: number | null;
  comment: string | null;
  ratedAt: string | null;
};

export type TripFeedbackRow = {
  id: string;
  bookingId: string;
  passenger: { name: string; phone?: string | null; seats: number };
  trip: FeedbackTrip;
  driverFeedback: RatingSide;
  busFeedback: RatingSide;
};

export type DriverRatingRow = {
  id: string;
  bookingId: string;
  passengerName: string;
  passengerPhone?: string | null;
  rating: number;
  comment: string | null;
  ratedAt: string;
  trip: FeedbackTrip;
};

export type DriverTripRow = {
  id: string;
  departAt: string;
  status: string;
  fare: string;
  line: FeedbackLine;
  bus: FeedbackBus;
  passengerCount: number;
  driverRatingAvg: number | null;
  busRatingAvg: number | null;
};

const q = (cursor: string | null) =>
  cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";

const ownerBase = (ownerId: string) => `/api/fleet-owners/${ownerId}`;

/** Rated bookings of one trip (trip's line must match too). */
export function fetchTripFeedbackPage(
  ownerId: string,
  lineId: string,
  tripId: string,
  cursor: string | null,
): Promise<ActionResult<CursorPage<TripFeedbackRow>>> {
  return apiGet<CursorPage<TripFeedbackRow>>(
    `${ownerBase(ownerId)}/trip-lines/${lineId}/trips/${tripId}/feedback${q(cursor)}`,
  );
}

/** Feedback attributed to one driver on one trip (404 unless it is the snapshot). */
export function fetchTripDriverFeedbackPage(
  ownerId: string,
  lineId: string,
  tripId: string,
  driverUserId: string,
  cursor: string | null,
): Promise<ActionResult<CursorPage<TripFeedbackRow>>> {
  return apiGet<CursorPage<TripFeedbackRow>>(
    `${ownerBase(ownerId)}/trip-lines/${lineId}/trips/${tripId}/drivers/${driverUserId}${q(cursor)}`,
  );
}

/** Every driver rating + comment for this owner company. */
export function fetchDriverRatingsPage(
  ownerId: string,
  driverUserId: string,
  cursor: string | null,
): Promise<ActionResult<CursorPage<DriverRatingRow>>> {
  return apiGet<CursorPage<DriverRatingRow>>(
    `${ownerBase(ownerId)}/drivers/${driverUserId}/ratings${q(cursor)}`,
  );
}

/** Trips the driver operated, with per-trip rating averages. */
export function fetchDriverTripsPage(
  ownerId: string,
  driverUserId: string,
  cursor: string | null,
): Promise<ActionResult<CursorPage<DriverTripRow>>> {
  return apiGet<CursorPage<DriverTripRow>>(
    `${ownerBase(ownerId)}/drivers/${driverUserId}/trips${q(cursor)}`,
  );
}
