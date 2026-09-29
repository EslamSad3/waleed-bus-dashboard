import { apiGet, apiSend, type ActionResult, type CursorPage } from "@/lib/actions/http";
import { notifyResult } from "@/lib/actions/toast";
import type { CreateTripInput, UpdateTripInput } from "@/lib/schemas/p1";
import { fetchOwnerTripLinesPage } from "@/lib/actions/trip-lines";
import { t } from "@/lib/i18n/t";

/**
 * Owner trips live under their trip line: `/fleet-owners/{ownerId}/trip-lines/
 * {lineId}/trips`. A trip's origin/destination are DERIVED from the line's
 * first/last ordered stop — never sent, never edited.
 */
const base = (ownerId: string, lineId: string) =>
  `/api/fleet-owners/${ownerId}/trip-lines/${lineId}/trips`;

export type TripLineRef = {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  qrIdentifier: string;
  isActive: boolean;
};

export type TripLineStop = {
  id: string;
  stationId: string;
  stopOrder: number;
  stopType: "BOARDING" | "LANDING";
  estimatedStopMinutes?: number | null;
  station: { id: string; name: string; address?: string | null };
};

export type Trip = {
  id: string;
  ownerId: string;
  busId: string;
  lineId: string;
  /** Snapshotted at departure; never rewritten by a later reassignment. */
  driverUserId?: string | null;
  origin: string | null;
  destination: string | null;
  departAt: string;
  fare: string;
  status: "SCHEDULED" | "DEPARTED" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
  line?: TripLineRef & { stops?: TripLineStop[] };
};

export type TripPage = CursorPage<Trip>;

export const TRIP_STATUS_AR: Record<Trip["status"], string> = {
  SCHEDULED: t("enums.tripStatus.scheduled"),
  DEPARTED: t("enums.tripStatus.running"),
  COMPLETED: t("enums.tripStatus.completed"),
  CANCELLED: t("enums.tripStatus.cancelled"),
};

export function fetchTripsPage(
  ownerId: string,
  lineId: string,
  cursor: string | null,
): Promise<ActionResult<TripPage>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<TripPage>(`${base(ownerId, lineId)}${q}`);
}

export function fetchTrip(ownerId: string, lineId: string, id: string): Promise<ActionResult<Trip>> {
  return apiGet<Trip>(`${base(ownerId, lineId)}/${id}`);
}

export function createTrip(ownerId: string, lineId: string, input: CreateTripInput): Promise<ActionResult<Trip>> {
  return notifyResult(t("trips.toast.created"), apiSend<Trip>(base(ownerId, lineId), "POST", input));
}

export function updateTrip(
  ownerId: string,
  lineId: string,
  id: string,
  input: UpdateTripInput,
): Promise<ActionResult<Trip>> {
  return notifyResult(
    input.status === "DEPARTED"
      ? t("trips.toast.departed")
      : input.status === "COMPLETED"
        ? t("trips.toast.completed")
        : input.status === "CANCELLED"
          ? t("trips.toast.cancelled")
          : t("trips.toast.saved"),
    apiSend<Trip>(`${base(ownerId, lineId)}/${id}`, "PATCH", input),
  );
}

export function deleteTrip(ownerId: string, lineId: string, id: string): Promise<ActionResult<null>> {
  return notifyResult(t("trips.toast.deleted"), apiSend<null>(`${base(ownerId, lineId)}/${id}`, "DELETE"));
}

/**
 * Trips are addressed by (line, trip), so a deep link has to resolve the line
 * first. Walks the owner's lines with cursor pagination and returns the first
 * match — the same fan-out the old cross-fleet lookup did, minus the fleets.
 */
export async function findTripAcrossLines(
  ownerId: string,
  tripId: string,
): Promise<ActionResult<{ lineId: string; trip: Trip }>> {
  let cursor: string | null = null;
  do {
    const lines = await fetchOwnerTripLinesPage(ownerId, cursor);
    if (!lines.ok) return lines;
    for (const line of lines.data.items) {
      const result = await fetchTrip(ownerId, line.id, tripId);
      if (result.ok) return { ok: true, data: { lineId: line.id, trip: result.data } };
      if (result.code === "NETWORK_ERROR") return result;
    }
    cursor = lines.data.nextCursor;
  } while (cursor);
  return { ok: false, message: t("common.notFound.inOwner"), code: "NOT_FOUND" };
}

/** Super-admin cross-owner trip index (`GET /fleet-owners/trips`). */
export function fetchSystemTripsPage(cursor: string | null): Promise<ActionResult<TripPage>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<TripPage>(`/api/fleet-owners/trips${q}`);
}
