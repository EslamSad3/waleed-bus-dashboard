import { apiDiscardStaged, apiGet, apiSend, apiSendFile, apiStageImage, type ActionResult, type CursorPage, type StagedUpload } from "@/lib/actions/http";
import { notifyResult, type NotifyOptions } from "@/lib/actions/toast";
import type { CreateBusInput, AssignDriverInput } from "@/lib/schemas/p1";
import { t } from "@/lib/i18n/t";

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
  return apiGet<BusPage>(`/api/fleet-owners/fleets/${fleetId}/buses${q}`);
}

export function fetchBus(fleetId: string, id: string): Promise<ActionResult<Bus>> {
  return apiGet<Bus>(`/api/fleet-owners/fleets/${fleetId}/buses/${id}`);
}

export function createBus(fleetId: string, input: CreateBusInput): Promise<ActionResult<Bus>> {
  return notifyResult(
    t("buses.toast.created"),
    apiSend<Bus>(`/api/fleet-owners/fleets/${fleetId}/buses`, "POST", input, "REGISTRATION_TAKEN"),
  );
}

export function updateBus(fleetId: string, id: string, input: { plateNumber?: string; color?: string; imageUrl?: string; brandId?: string | null; isAirConditioned?: boolean; modelYear?: number; capacity?: number; isActive?: boolean }): Promise<ActionResult<Bus>> {
  return notifyResult(
    t("buses.toast.saved"),
    apiSend<Bus>(`/api/fleet-owners/fleets/${fleetId}/buses/${id}`, "PATCH", input, "REGISTRATION_TAKEN"),
  );
}

/**
 * Stage a bus image via direct browser→Supabase upload (Vercel-safe).
 * Link `staged.publicUrl` as `imageUrl` on create/update, and discard the
 * staged object when the user cancels or the record write fails.
 */
export function stageBusImage(fleetId: string, file: File, signal?: AbortSignal): Promise<ActionResult<StagedUpload>> {
  return apiStageImage("bus-image", file, { fleetId }, signal);
}

/** Best-effort cleanup of a staged bus image (cancel / failed record write). */
export function discardBusImage(fleetId: string, staged: StagedUpload): Promise<void> {
  return apiDiscardStaged(staged, { fleetId });
}

/**
 * @deprecated Use stageBusImage + imageUrl instead. The legacy multipart path
 * proxies file bytes through Vercel and 503s under load.
 */
export function uploadBusImage(fleetId: string, file: File, opts?: NotifyOptions): Promise<ActionResult<{ url: string }>> {
  return notifyResult(
    t("buses.toast.imageUploaded"),
    apiSendFile<{ url: string }>(`/api/fleet-owners/fleets/${fleetId}/uploads/bus-image`, file),
    opts,
  );
}

export const fetchBrands = (includeInactive = false) =>
  apiGet<VehicleBrand[]>(`/api/brands${includeInactive ? "?includeInactive=true" : ""}`);
export const fetchBrandById = (id: string) => apiGet<VehicleBrand>(`/api/brands/${id}`);
export const createBrand = (input: { name: string; sortOrder?: number; isActive?: boolean }) =>
  notifyResult(t("brands.toast.created"), apiSend<VehicleBrand>("/api/brands", "POST", input));
export const updateBrand = (id: string, input: { name?: string; sortOrder?: number; isActive?: boolean }) =>
  notifyResult(
    input.isActive === undefined ? t("brands.toast.saved") : input.isActive ? t("brands.toast.activated") : t("brands.toast.deactivated"),
    apiSend<VehicleBrand>(`/api/brands/${id}`, "PATCH", input),
  );
export const deleteBrand = (id: string) =>
  notifyResult(t("brands.toast.deleted"), apiSend<null>(`/api/brands/${id}`, "DELETE"));

export function deleteBus(fleetId: string, id: string): Promise<ActionResult<null>> {
  return notifyResult(t("buses.toast.deleted"), apiSend<null>(`/api/fleet-owners/fleets/${fleetId}/buses/${id}`, "DELETE"));
}

/** Tenant lifecycle actions (research R1) — fleetId sent as x-fleet-id. */
export function disableBus(fleetId: string, busId: string): Promise<ActionResult<Bus>> {
  return notifyResult(
    t("buses.toast.disabled"),
    apiSend<Bus>(`/api/fleet/buses/${busId}/disable`, "POST", undefined, undefined, fleetId),
  );
}

export function reactivateBus(fleetId: string, busId: string): Promise<ActionResult<Bus>> {
  return notifyResult(
    t("buses.toast.enabled"),
    apiSend<Bus>(`/api/fleet/buses/${busId}/reactivate`, "POST", undefined, undefined, fleetId),
  );
}

export function assignDriver(fleetId: string, busId: string, input: AssignDriverInput): Promise<ActionResult<unknown>> {
  return notifyResult(
    t("buses.toast.driverAssigned"),
    apiSend(`/api/fleet/buses/${busId}/driver`, "POST", input, undefined, fleetId),
  );
}

export function unassignDriver(fleetId: string, busId: string): Promise<ActionResult<null>> {
  return notifyResult(
    t("buses.toast.driverUnassigned"),
    apiSend<null>(`/api/fleet/buses/${busId}/driver`, "DELETE", undefined, undefined, fleetId),
  );
}

export function assignTripLine(fleetId: string, busId: string, tripLineId: string): Promise<ActionResult<Bus>> {
  return notifyResult(
    t("buses.toast.lineAssigned"),
    apiSend<Bus>(`/api/fleet/buses/${busId}/trip-line`, "POST", { tripLineId }, undefined, fleetId),
  );
}

export function unassignTripLine(fleetId: string, busId: string): Promise<ActionResult<null>> {
  return notifyResult(
    t("buses.toast.lineUnassigned"),
    apiSend<null>(`/api/fleet/buses/${busId}/trip-line`, "DELETE", undefined, undefined, fleetId),
  );
}

export function fetchBusTripsPage(fleetId: string, busId: string, cursor: string | null): Promise<ActionResult<CursorPage<TripRef>>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet(`/api/fleet/buses/${busId}/trips${q}`, fleetId);
}
