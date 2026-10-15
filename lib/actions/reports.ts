import { apiGet, type ActionResult, type CursorPage } from "@/lib/actions/http";

export type PassengerReport = {
  id: string;
  tripId: string;
  bookingId: string;
  passengerId: string;
  driverId: string;
  note: string;
  createdAt: string;
};

export type FleetReports = {
  reports: CursorPage<PassengerReport>;
  ratingSummary: {
    busAvg: number | null;
    driverAvg: number | null;
    count: number;
  };
};

/** Owner-report endpoint scoped to the selected owner company. */
export function fetchOwnerReports(ownerId: string, cursor: string | null = null): Promise<ActionResult<FleetReports>> {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", cursor);
  return apiGet<FleetReports>(`/api/fleet-owners/${ownerId}/reports?${query}`);
}
