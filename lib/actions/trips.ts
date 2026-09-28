import { apiGet, apiSend, type ActionResult, type CursorPage } from "@/lib/actions/http";
import { notifyResult } from "@/lib/actions/toast";
import type { CreateTripInput } from "@/lib/schemas/p1";
import { fetchFleetsPage } from "@/lib/actions/fleets";
import { t } from "@/lib/i18n/t";

export type Trip = {
  id: string;
  fleetId: string;
  busId: string;
  origin: string;
  destination: string;
  departAt: string;
  status: "SCHEDULED" | "DEPARTED" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
};

export type TripPage = CursorPage<Trip>;

export const TRIP_STATUS_AR: Record<Trip["status"], string> = {
  SCHEDULED: t("enums.tripStatus.scheduled"),
  DEPARTED: t("enums.tripStatus.running"),
  COMPLETED: t("enums.tripStatus.completed"),
  CANCELLED: t("enums.tripStatus.cancelled"),
};

export function fetchTripsPage(fleetId: string, cursor: string | null): Promise<ActionResult<TripPage>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<TripPage>(`/api/fleets/${fleetId}/trips${q}`);
}

export function fetchTrip(fleetId: string, id: string): Promise<ActionResult<Trip>> {
  return apiGet<Trip>(`/api/fleets/${fleetId}/trips/${id}`);
}

export async function findTripAcrossFleets(id: string): Promise<ActionResult<{ fleetId: string; trip: Trip }>> {
  let cursor: string | null = null;
  do {
    const fleets = await fetchFleetsPage(cursor);
    if (!fleets.ok) return fleets;
    for (const fleet of fleets.data.items) {
      const result = await fetchTrip(fleet.id, id);
      if (result.ok) return { ok: true, data: { fleetId: fleet.id, trip: result.data } };
      if (result.code === "NETWORK_ERROR") return result;
    }
    cursor = fleets.data.nextCursor;
  } while (cursor);
  return { ok: false, message: t("common.notFound.inFleet"), code: "NOT_FOUND" };
}

export function createTrip(fleetId: string, input: CreateTripInput): Promise<ActionResult<Trip>> {
  return notifyResult(t("trips.toast.created"), apiSend<Trip>(`/api/fleets/${fleetId}/trips`, "POST", input));
}

export function updateTrip(fleetId: string, id: string, input: { origin?: string; destination?: string; departAt?: string; status?: Trip["status"] }): Promise<ActionResult<Trip>> {
  return notifyResult(
    input.status === "DEPARTED"
      ? t("trips.toast.departed")
      : input.status === "COMPLETED"
        ? t("trips.toast.completed")
        : input.status === "CANCELLED"
          ? t("trips.toast.cancelled")
          : t("trips.toast.saved"),
    apiSend<Trip>(`/api/fleets/${fleetId}/trips/${id}`, "PATCH", input),
  );
}

export function deleteTrip(fleetId: string, id: string): Promise<ActionResult<null>> {
  return notifyResult(t("trips.toast.deleted"), apiSend<null>(`/api/fleets/${fleetId}/trips/${id}`, "DELETE"));
}
