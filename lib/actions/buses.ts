import { apiDiscardStaged, apiGet, apiSend, apiSendFile, apiStageImage, type ActionResult, type CursorPage, type StagedUpload } from "@/lib/actions/http";
import { notifyResult, type NotifyOptions } from "@/lib/actions/toast";
import type { CreateBusInput, AssignDriverInput } from "@/lib/schemas/p1";
import { t } from "@/lib/i18n/t";

/** Owner-scoped bus reads/writes. The owner id is the tenant selector. */
const base = (ownerId: string) => `/api/fleet-owners/${ownerId}/buses`;

export type VehicleBrand = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

export type Bus = {
  id: string;
  ownerId: string;
  registrationNumber: string;
  plateNumber?: string | null;
  color?: string | null;
  imageUrl?: string | null;
  brandId?: string | null;
  brand?: VehicleBrand | null;
  isAirConditioned?: boolean | null;
  modelYear?: number | null;
  capacity: number;
  isActive: boolean;
  /** Mean bus rating across the bus's trips; null when nobody rated it yet. */
  avgRating?: number | null;
  /** Trips this bus has run, across every line. */
  tripCount?: number;
  /** Driver of the bus's live (DEPARTED) trip; null when no trip is live. */
  liveDriver?: { tripId: string; driverId: string; name: string | null; phoneNumber: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

export type BusPage = CursorPage<Bus>;

/** Super-admin cross-owner bus index (`GET /fleet-owners/buses`). */
export function fetchSystemBusesPage(cursor: string | null): Promise<ActionResult<BusPage>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<BusPage>(`/api/fleet-owners/buses${q}`);
}

/** One row of `GET /fleet-owners/{ownerId}/buses/{busId}/trips`. */
export type BusTripRow = {
  id: string;
  departAt: string;
  status: string;
  fare: string;
  line: { id: string; name: string; code: string | null; origin: string | null; destination: string | null };
  bus: { id: string; registrationNumber: string; plateNumber: string | null };
  driver: { id: string; name: string | null; nickname?: string | null; picture?: string | null } | null;
  passengerCount: number;
  busRatingAvg: number | null;
};

export function fetchBusesPage(ownerId: string, cursor: string | null): Promise<ActionResult<BusPage>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<BusPage>(`${base(ownerId)}${q}`);
}

export function fetchBus(ownerId: string, id: string): Promise<ActionResult<Bus>> {
  return apiGet<Bus>(`${base(ownerId)}/${id}`);
}

export function createBus(ownerId: string, input: CreateBusInput, opts?: NotifyOptions): Promise<ActionResult<Bus>> {
  return notifyResult(
    t("buses.toast.created"),
    apiSend<Bus>(base(ownerId), "POST", input, "REGISTRATION_TAKEN"),
    opts,
  );
}

export function updateBus(ownerId: string, id: string, input: { plateNumber?: string; color?: string; imageUrl?: string; brandId?: string | null; isAirConditioned?: boolean; modelYear?: number; capacity?: number; isActive?: boolean }): Promise<ActionResult<Bus>> {
  return notifyResult(
    t("buses.toast.saved"),
    apiSend<Bus>(`${base(ownerId)}/${id}`, "PATCH", input, "REGISTRATION_TAKEN"),
  );
}

/**
 * Stage a bus image via direct browser→Supabase upload (Vercel-safe).
 * Link `staged.publicUrl` as `imageUrl` on create/update, and discard the
 * staged object when the user cancels or the record write fails.
 */
export function stageBusImage(ownerId: string, file: File, signal?: AbortSignal): Promise<ActionResult<StagedUpload>> {
  return apiStageImage("bus-image", file, { ownerId }, signal);
}

/** Best-effort cleanup of a staged bus image (cancel / failed record write). */
export function discardBusImage(ownerId: string, staged: StagedUpload): Promise<void> {
  return apiDiscardStaged(staged, { ownerId });
}

/**
 * @deprecated Use stageBusImage + imageUrl instead. The legacy multipart path
 * proxies file bytes through Vercel and 503s under load.
 */
export function uploadBusImage(ownerId: string, file: File, opts?: NotifyOptions): Promise<ActionResult<{ url: string }>> {
  return notifyResult(
    t("buses.toast.imageUploaded"),
    apiSendFile<{ url: string }>(`/api/fleet-owners/${ownerId}/uploads/bus-image`, file),
    opts,
  );
}

export function deleteBus(ownerId: string, id: string): Promise<ActionResult<null>> {
  return notifyResult(t("buses.toast.deleted"), apiSend<null>(`${base(ownerId)}/${id}`, "DELETE"));
}

export function disableBus(ownerId: string, busId: string): Promise<ActionResult<Bus>> {
  return notifyResult(
    t("buses.toast.disabled"),
    apiSend<Bus>(`${base(ownerId)}/${busId}/disable`, "POST"),
  );
}

export function reactivateBus(ownerId: string, busId: string): Promise<ActionResult<Bus>> {
  return notifyResult(
    t("buses.toast.enabled"),
    apiSend<Bus>(`${base(ownerId)}/${busId}/reactivate`, "POST"),
  );
}

export function assignDriver(
  ownerId: string,
  busId: string,
  input: AssignDriverInput,
  opts?: NotifyOptions,
): Promise<ActionResult<unknown>> {
  return notifyResult(
    t("buses.toast.driverAssigned"),
    apiSend(`${base(ownerId)}/${busId}/driver`, "POST", input),
    opts,
  );
}

export function unassignDriver(ownerId: string, busId: string, tripId: string): Promise<ActionResult<null>> {
  return notifyResult(
    t("buses.toast.driverUnassigned"),
    apiSend<null>(`${base(ownerId)}/${busId}/driver?tripId=${encodeURIComponent(tripId)}`, "DELETE"),
  );
}

export function fetchBusTripsPage(
  ownerId: string,
  busId: string,
  cursor: string | null,
): Promise<ActionResult<CursorPage<BusTripRow>>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<CursorPage<BusTripRow>>(`${base(ownerId)}/${busId}/trips${q}`);
}

/** One passenger's bus rating + comment, with the trip/line/driver context. */
export type BusRatingRow = {
  id: string;
  bookingId: string;
  passengerName: string | null;
  passengerPhone: string | null;
  rating: number | null;
  comment: string | null;
  ratedAt: string | null;
  trip: {
    id: string;
    departAt: string;
    status: string;
    line: { id: string; name: string; code: string | null; origin: string | null; destination: string | null };
    driver: { id: string; name: string | null; nickname?: string | null; picture?: string | null } | null;
  };
  bus: { id: string; registrationNumber: string; plateNumber: string | null };
};

/** Every rating and comment left on this bus, newest first. */
export function fetchBusRatingsPage(
  ownerId: string,
  busId: string,
  cursor: string | null,
): Promise<ActionResult<CursorPage<BusRatingRow>>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<CursorPage<BusRatingRow>>(`${base(ownerId)}/${busId}/ratings${q}`);
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
