import { apiDiscardStaged, apiGet, apiSend, apiSendFile, apiStageImage, type ActionResult, type CursorPage, type StagedUpload } from "@/lib/actions/http";
import { notifyResult, type NotifyOptions } from "@/lib/actions/toast";
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
  return notifyResult(
    "اتضافت العربية بنجاح",
    apiSend<Bus>(`/api/fleets/${fleetId}/buses`, "POST", input, "REGISTRATION_TAKEN"),
  );
}

export function updateBus(fleetId: string, id: string, input: { plateNumber?: string; color?: string; imageUrl?: string; brandId?: string | null; isAirConditioned?: boolean; modelYear?: number; capacity?: number; isActive?: boolean }): Promise<ActionResult<Bus>> {
  return notifyResult(
    "اتحفظت بيانات العربية",
    apiSend<Bus>(`/api/fleets/${fleetId}/buses/${id}`, "PATCH", input, "REGISTRATION_TAKEN"),
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
    "اترفعت صورة العربية",
    apiSendFile<{ url: string }>(`/api/fleets/${fleetId}/uploads/bus-image`, file),
    opts,
  );
}

export const fetchBrands = (includeInactive = false) =>
  apiGet<VehicleBrand[]>(`/api/brands${includeInactive ? "?includeInactive=true" : ""}`);
export const fetchBrandById = (id: string) => apiGet<VehicleBrand>(`/api/brands/${id}`);
export const createBrand = (input: { name: string; sortOrder?: number; isActive?: boolean }) =>
  notifyResult("اتضافت الماركة بنجاح", apiSend<VehicleBrand>("/api/brands", "POST", input));
export const updateBrand = (id: string, input: { name?: string; sortOrder?: number; isActive?: boolean }) =>
  notifyResult(
    input.isActive === undefined ? "اتحفظت بيانات الماركة" : input.isActive ? "تم تنشيط الماركة" : "تم إيقاف الماركة",
    apiSend<VehicleBrand>(`/api/brands/${id}`, "PATCH", input),
  );
export const deleteBrand = (id: string) =>
  notifyResult("اتمسحت الماركة", apiSend<null>(`/api/brands/${id}`, "DELETE"));

export function deleteBus(fleetId: string, id: string): Promise<ActionResult<null>> {
  return notifyResult("اتمسحت العربية", apiSend<null>(`/api/fleets/${fleetId}/buses/${id}`, "DELETE"));
}

/** Tenant lifecycle actions (research R1) — fleetId sent as x-fleet-id. */
export function disableBus(fleetId: string, busId: string): Promise<ActionResult<Bus>> {
  return notifyResult(
    "تم إيقاف العربية",
    apiSend<Bus>(`/api/fleet/buses/${busId}/disable`, "POST", undefined, undefined, fleetId),
  );
}

export function reactivateBus(fleetId: string, busId: string): Promise<ActionResult<Bus>> {
  return notifyResult(
    "تم إعادة تشغيل العربية",
    apiSend<Bus>(`/api/fleet/buses/${busId}/reactivate`, "POST", undefined, undefined, fleetId),
  );
}

export function assignDriver(fleetId: string, busId: string, input: AssignDriverInput): Promise<ActionResult<unknown>> {
  return notifyResult(
    "تم تعيين السواق على العربية",
    apiSend(`/api/fleet/buses/${busId}/driver`, "POST", input, undefined, fleetId),
  );
}

export function unassignDriver(fleetId: string, busId: string): Promise<ActionResult<null>> {
  return notifyResult(
    "تم إلغاء تعيين السواق",
    apiSend<null>(`/api/fleet/buses/${busId}/driver`, "DELETE", undefined, undefined, fleetId),
  );
}

export function assignTripLine(fleetId: string, busId: string, tripLineId: string): Promise<ActionResult<Bus>> {
  return notifyResult(
    "تم ربط العربية بالخط",
    apiSend<Bus>(`/api/fleet/buses/${busId}/trip-line`, "POST", { tripLineId }, undefined, fleetId),
  );
}

export function unassignTripLine(fleetId: string, busId: string): Promise<ActionResult<null>> {
  return notifyResult(
    "تم إلغاء ربط العربية بالخط",
    apiSend<null>(`/api/fleet/buses/${busId}/trip-line`, "DELETE", undefined, undefined, fleetId),
  );
}

export function fetchBusTripsPage(fleetId: string, busId: string, cursor: string | null): Promise<ActionResult<CursorPage<TripRef>>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet(`/api/fleet/buses/${busId}/trips${q}`, fleetId);
}
