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

/** Owner-report endpoint scoped through the dashboard's selected fleet. */
export function fetchFleetReports(fleetId: string): Promise<ActionResult<FleetReports>> {
  return apiGet<FleetReports>("/api/fleet/reports", fleetId);
}
