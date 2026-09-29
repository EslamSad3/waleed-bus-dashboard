import { apiGet, type ActionResult } from "@/lib/actions/http";

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
  reports: PassengerReport[];
  ratingSummary: {
    busAvg: number | null;
    driverAvg: number | null;
    count: number;
  };
};

/** Owner-report endpoint scoped to the selected owner company. */
export function fetchOwnerReports(ownerId: string): Promise<ActionResult<FleetReports>> {
  return apiGet<FleetReports>(`/api/fleet-owners/${ownerId}/reports`);
}
