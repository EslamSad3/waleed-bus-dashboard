import { apiGet, apiSend, type ActionResult, type CursorPage } from "@/lib/actions/http";
import { notifyResult } from "@/lib/actions/toast";
import { t } from "@/lib/i18n/t";

export type Governorate = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
};

export type Markaz = {
  id: string;
  governorateId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  governorate?: Governorate;
};

export type Locality = {
  id: string;
  markazId: string;
  nameAr: string;
  nameEn: string;
  type: "CITY" | "VILLAGE";
  isActive: boolean;
  markaz?: Markaz & { governorate?: Governorate };
};

export type Stop = {
  id: string;
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  governorateId: string;
  governorate: Governorate;
  localityId?: string | null;
  locality?: (Locality & { markaz?: Markaz & { governorate?: Governorate } }) | null;
  isActive: boolean;
};

/** One row of a line's single ordered stop collection. */
export type TripLineStop = {
  id: string;
  stationId: string;
  stopOrder: number;
  estimatedStopMinutes?: number | null;
  stopType: "BOARDING" | "LANDING" | "BOTH";
  station: Stop;
};

/** An owner trip line IS one direction; a return journey is a separate line. */
export type TripLine = {
  id: string;
  ownerId: string;
  name: string;
  code: string;
  qrIdentifier: string;
  isActive: boolean;
  stops: TripLineStop[];
};

/**
 * A line has no stored origin/destination: they are the first and last ORDERED
 * stop, which is the same rule the API uses to derive a trip's endpoints.
 */
export function lineEndpoints(line: Pick<TripLine, "stops">): {
  origin: string | null;
  destination: string | null;
} {
  const ordered = [...line.stops].sort((a, b) => a.stopOrder - b.stopOrder);
  return {
    origin: ordered[0]?.station.name ?? null,
    destination: ordered[ordered.length - 1]?.station.name ?? null,
  };
}

export const fetchStops = () => apiGet<Stop[]>("/api/stops");
export const fetchGovernorates = () => apiGet<Governorate[]>("/api/governorates");
export const fetchMarkaz = (governorateId: string, includeInactive = false) =>
  apiGet<Markaz[]>(`/api/governorates/${governorateId}/markaz${includeInactive ? "?includeInactive=true" : ""}`);
export const fetchMarkazAll = (includeInactive = true) =>
  apiGet<Markaz[]>(`/api/markaz${includeInactive ? "?includeInactive=true" : ""}`);
export const fetchMarkazById = (id: string) => apiGet<Markaz>(`/api/markaz/${id}`);
export const createMarkaz = (input: { governorateId: string; code: string; nameAr: string; nameEn: string; isActive?: boolean }) =>
  notifyResult(t("markaz.toast.created"), apiSend<Markaz>("/api/markaz", "POST", input));
export const updateMarkaz = (id: string, input: { nameAr?: string; nameEn?: string; isActive?: boolean }) =>
  notifyResult(
    input.isActive === undefined ? t("markaz.toast.saved") : input.isActive ? t("markaz.toast.activated") : t("markaz.toast.deactivated"),
    apiSend<Markaz>(`/api/markaz/${id}`, "PATCH", input),
  );
export const deleteMarkaz = (id: string) =>
  notifyResult(t("markaz.toast.deleted"), apiSend<null>(`/api/markaz/${id}`, "DELETE"));
export const fetchLocalities = (markazId: string, includeInactive = false) =>
  apiGet<Locality[]>(`/api/markaz/${markazId}/localities${includeInactive ? "?includeInactive=true" : ""}`);
export const fetchLocalitiesAll = (
  filters: { governorateId?: string | null; markazId?: string | null; includeInactive?: boolean } = {},
) => {
  const params = new URLSearchParams();
  if (filters.governorateId) params.set("governorateId", filters.governorateId);
  if (filters.markazId) params.set("markazId", filters.markazId);
  if (filters.includeInactive) params.set("includeInactive", "true");
  const qs = params.toString();
  return apiGet<Locality[]>(`/api/localities${qs ? `?${qs}` : ""}`);
};
export const fetchLocalityById = (id: string) => apiGet<Locality>(`/api/localities/${id}`);
export const createLocality = (input: { markazId: string; type: "CITY" | "VILLAGE"; nameAr: string; nameEn: string; isActive?: boolean }) =>
  notifyResult(t("localities.toast.created"), apiSend<Locality>("/api/localities", "POST", input));
export const updateLocality = (id: string, input: { nameAr?: string; nameEn?: string; isActive?: boolean }) =>
  notifyResult(
    input.isActive === undefined
      ? t("localities.toast.saved")
      : input.isActive
        ? t("localities.toast.activated")
        : t("localities.toast.deactivated"),
    apiSend<Locality>(`/api/localities/${id}`, "PATCH", input),
  );
export const deleteLocality = (id: string) =>
  notifyResult(t("localities.toast.deleted"), apiSend<null>(`/api/localities/${id}`, "DELETE"));
export const fetchStop = (id: string) => apiGet<Stop>(`/api/stops/${id}`);
export type StopInput = Omit<Stop, "id" | "governorate">;
export const createStop = (input: StopInput) =>
  notifyResult(t("stops.toast.created"), apiSend<Stop>("/api/stops", "POST", input));
export const updateStop = (id: string, input: Partial<StopInput>) =>
  notifyResult(t("stops.toast.saved"), apiSend<Stop>(`/api/stops/${id}`, "PATCH", input));
export const deleteStop = (id: string) =>
  notifyResult(t("stops.toast.deleted"), apiSend<null>(`/api/stops/${id}`, "DELETE"));

// ---- Owner trip lines (one line = one direction) ----
const lineBase = (ownerId: string) => `/api/fleet-owners/${ownerId}/trip-lines`;

export type LineStopInput = {
  stopId: string;
  stopType: "BOARDING" | "LANDING";
  estimatedStopMinutes?: number;
};

export function fetchOwnerTripLinesPage(
  ownerId: string,
  cursor: string | null,
): Promise<ActionResult<CursorPage<TripLine>>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<CursorPage<TripLine>>(`${lineBase(ownerId)}${q}`);
}

export const fetchOwnerTripLine = (ownerId: string, id: string) =>
  apiGet<TripLine>(`${lineBase(ownerId)}/${id}`);

export const createOwnerTripLine = (
  ownerId: string,
  input: { name: string; code: string; qrIdentifier?: string; stops: LineStopInput[] },
) =>
  notifyResult(
    t("tripLines.toast.created"),
    apiSend<TripLine>(lineBase(ownerId), "POST", input),
  );

export const updateOwnerTripLine = (
  ownerId: string,
  id: string,
  input: { name?: string; isActive?: boolean },
) =>
  notifyResult(
    input.isActive === undefined
      ? t("tripLines.toast.saved")
      : input.isActive
        ? t("tripLines.toast.activated")
        : t("tripLines.toast.deactivated"),
    apiSend<TripLine>(`${lineBase(ownerId)}/${id}`, "PATCH", input),
  );

/**
 * Replace the line's ordered stops. The server refuses this with
 * 409 LINE_HAS_TRIPS once the line has trips, so booked and completed
 * journeys keep their route.
 */
export const updateOwnerTripLineStops = (ownerId: string, lineId: string, stops: LineStopInput[]) =>
  notifyResult(
    t("tripLines.toast.stopsSaved"),
    apiSend<TripLine>(`${lineBase(ownerId)}/${lineId}/stops`, "PATCH", { stops }),
  );

export const deleteOwnerTripLine = (ownerId: string, id: string) =>
  notifyResult(t("tripLines.toast.deleted"), apiSend<null>(`${lineBase(ownerId)}/${id}`, "DELETE"));

/** Super-admin cross-owner line index (`GET /fleet-owners/trip-lines`). */
export const fetchSystemTripLinesPage = (cursor: string | null) => {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<CursorPage<TripLine>>(`/api/fleet-owners/trip-lines${q}`);
};

export type { ActionResult };
