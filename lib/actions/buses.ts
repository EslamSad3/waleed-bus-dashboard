import { apiGet, apiSend, apiSendFile, type ActionResult, type CursorPage } from "@/lib/actions/http";
import type { CreateBusInput, AssignDriverInput } from "@/lib/schemas/p1";

export type VehicleBrand = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

export type Bus = {
  id: string;
  fleetId: string;
  registrationNumber: string;
  plateNumber?: string | null;
  color?: string | null;
  imageUrl?: string | null;
  brandId?: string | null;
  brand?: VehicleBrand | null;
  isAirConditioned?: boolean | null;
  modelYear?: number | null;
  capacity: number;
  lineId?: string | null;
  line?: { id: string; name: string; code: string } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BusPage = CursorPage<Bus>;
export type TripRef = { id: string; origin: string; destination: string; departAt: string; status: string };

export function fetchBusesPage(fleetId: string, cursor: string | null): Promise<ActionResult<BusPage>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<BusPage>(`/api/fleets/${fleetId}/buses${q}`);
}

export function fetchBus(fleetId: string, id: string): Promise<ActionResult<Bus>> {
  return apiGet<Bus>(`/api/fleets/${fleetId}/buses/${id}`);
}

export function createBus(fleetId: string, input: CreateBusInput): Promise<ActionResult<Bus>> {
  return apiSend<Bus>(`/api/fleets/${fleetId}/buses`, "POST", input, "REGISTRATION_TAKEN");
}

export function updateBus(fleetId: string, id: string, input: { plateNumber?: string; color?: string; imageUrl?: string; brandId?: string | null; isAirConditioned?: boolean; modelYear?: number; capacity?: number; isActive?: boolean }): Promise<ActionResult<Bus>> {
  return apiSend<Bus>(`/api/fleets/${fleetId}/buses/${id}`, "PATCH", input, "REGISTRATION_TAKEN");
}

export function uploadBusImage(fleetId: string, file: File): Promise<ActionResult<{ url: string }>> {
  return apiSendFile<{ url: string }>(`/api/fleets/${fleetId}/uploads/bus-image`, file);
}

export const fetchBrands = (includeInactive = false) =>
  apiGet<VehicleBrand[]>(`/api/brands${includeInactive ? "?includeInactive=true" : ""}`);
export const fetchBrandById = (id: string) => apiGet<VehicleBrand>(`/api/brands/${id}`);
export const createBrand = (input: { name: string; sortOrder?: number; isActive?: boolean }) => apiSend<VehicleBrand>("/api/brands", "POST", input);
export const updateBrand = (id: string, input: { name?: string; sortOrder?: number; isActive?: boolean }) => apiSend<VehicleBrand>(`/api/brands/${id}`, "PATCH", input);

export function deleteBus(fleetId: string, id: string): Promise<ActionResult<null>> {
  return apiSend<null>(`/api/fleets/${fleetId}/buses/${id}`, "DELETE");
}

/** Tenant lifecycle actions (research R1) — fleetId sent as x-fleet-id. */
export function disableBus(fleetId: string, busId: string): Promise<ActionResult<Bus>> {
  return apiSend<Bus>(`/api/fleet/buses/${busId}/disable`, "POST", undefined, undefined, fleetId);
}

export function reactivateBus(fleetId: string, busId: string): Promise<ActionResult<Bus>> {
  return apiSend<Bus>(`/api/fleet/buses/${busId}/reactivate`, "POST", undefined, undefined, fleetId);
}

export function assignDriver(fleetId: string, busId: string, input: AssignDriverInput): Promise<ActionResult<unknown>> {
  return apiSend(`/api/fleet/buses/${busId}/driver`, "POST", input, undefined, fleetId);
}

export function unassignDriver(fleetId: string, busId: string): Promise<ActionResult<null>> {
  return apiSend<null>(`/api/fleet/buses/${busId}/driver`, "DELETE", undefined, undefined, fleetId);
}

export function assignTripLine(fleetId: string, busId: string, tripLineId: string): Promise<ActionResult<Bus>> {
  return apiSend<Bus>(`/api/fleet/buses/${busId}/trip-line`, "POST", { tripLineId }, undefined, fleetId);
}

export function unassignTripLine(fleetId: string, busId: string): Promise<ActionResult<null>> {
  return apiSend<null>(`/api/fleet/buses/${busId}/trip-line`, "DELETE", undefined, undefined, fleetId);
}

export function fetchBusTripsPage(fleetId: string, busId: string, cursor: string | null): Promise<ActionResult<CursorPage<TripRef>>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet(`/api/fleet/buses/${busId}/trips${q}`, fleetId);
}
