import { apiGet, apiSend, type ActionResult, type CursorPage } from "@/lib/actions/http";
import { notifyResult, type NotifyOptions } from "@/lib/actions/toast";
import { t } from "@/lib/i18n/t";
import type { FareInput, FarePair } from "@/lib/line-fares";

export type Governorate = {
  id: string;
  code: string | null;
  nameAr: string;
  nameEn: string | null;
};

export type Markaz = {
  id: string;
  governorateId: string;
  code: string | null;
  nameAr: string;
  nameEn: string | null;
  isActive: boolean;
  governorate?: Governorate;
};

export type Locality = {
  id: string;
  markazId: string;
  nameAr: string;
  nameEn: string | null;
  type: "CITY" | "VILLAGE";
  isActive: boolean;
  markaz?: Markaz & { governorate?: Governorate };
};

export type Stop = {
  id: string;
  name: string;
  /** English name for passengers using the app in English; null = falls back to `name`. */
  nameEn?: string | null;
  address?: string | null;
  addressEn?: string | null;
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
  stopType: "BOARDING" | "LANDING";
  station: Stop;
};

/** An owner trip line IS one direction; a return journey is a separate line. */
export type TripLine = {
  pricingRevision?: number;
  pricingEnabled?: boolean;
  fares?: FareInput[];
  id: string;
  ownerId: string;
  name: string;
  nameEn?: string | null;
  code: string | null;
  qrIdentifier: string;
  isActive: boolean;
  stops: TripLineStop[];
};

/** Compact list rows do not contain the detail stop collection. */
export type TripLineListItem = Pick<TripLine, 'id' | 'ownerId' | 'name' | 'nameEn' | 'code' | 'qrIdentifier' | 'isActive'> & {
  origin: string | null;
  destination: string | null;
  stopCount: number;
};

export { lineEndpoints, lineStopCount } from '@/lib/trip-line-view';

export const fetchStops = () => apiGet<Stop[]>("/api/stops");
export const fetchGovernorates = () => apiGet<Governorate[]>("/api/governorates");
export const updateGovernorate = (id: string, input: { code?: string | null; nameAr?: string; nameEn?: string | null }) =>
  notifyResult(t("governorates.toast.saved"), apiSend<Governorate>(`/api/governorates/${id}`, "PATCH", input));
export const fetchMarkaz = (governorateId: string, includeInactive = false) =>
  apiGet<Markaz[]>(`/api/governorates/${governorateId}/markaz${includeInactive ? "?includeInactive=true" : ""}`);
export const fetchMarkazAll = (includeInactive = true) =>
  apiGet<Markaz[]>(`/api/markaz${includeInactive ? "?includeInactive=true" : ""}`);
export const fetchMarkazById = (id: string) => apiGet<Markaz>(`/api/markaz/${id}`);
export const createMarkaz = (input: { governorateId: string; code?: string | null; nameAr: string; nameEn?: string | null; isActive?: boolean }) =>
  notifyResult(t("markaz.toast.created"), apiSend<Markaz>("/api/markaz", "POST", input));
export const updateMarkaz = (id: string, input: { code?: string | null; governorateId?: string; nameAr?: string; nameEn?: string | null; isActive?: boolean }) =>
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
export const createLocality = (input: { markazId: string; type: "CITY" | "VILLAGE"; nameAr: string; nameEn?: string | null; isActive?: boolean }) =>
  notifyResult(t("localities.toast.created"), apiSend<Locality>("/api/localities", "POST", input));
export const updateLocality = (id: string, input: { nameAr?: string; nameEn?: string | null; isActive?: boolean }) =>
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
};

export function fetchOwnerTripLinesPage(
  ownerId: string,
  cursor: string | null,
): Promise<ActionResult<CursorPage<TripLineListItem>>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<CursorPage<TripLineListItem>>(`${lineBase(ownerId)}${q}`);
}

export const fetchOwnerTripLine = (ownerId: string, id: string) =>
  apiGet<TripLine>(`${lineBase(ownerId)}/${id}`);

export const createOwnerTripLine = (
  ownerId: string,
  input: { name: string; nameEn?: string | null; code?: string | null; qrIdentifier?: string; stops: LineStopInput[]; fares?: FareInput[] },
) =>
  notifyResult(
    t("tripLines.toast.created"),
    apiSend<TripLine>(lineBase(ownerId), "POST", input),
  );

export const updateOwnerTripLine = (
  ownerId: string,
  id: string,
  input: { name?: string; nameEn?: string | null; code?: string | null; isActive?: boolean },
  opts?: NotifyOptions,
) =>
  notifyResult(
    input.isActive === undefined
      ? t("tripLines.toast.saved")
      : input.isActive
        ? t("tripLines.toast.activated")
        : t("tripLines.toast.deactivated"),
    apiSend<TripLine>(`${lineBase(ownerId)}/${id}`, "PATCH", input),
    opts,
  );

/**
 * Replace the line's ordered stops. Trips with a confirmed booking, or that
 * already ran, keep the stops they had (the server freezes them first); every
 * other trip follows the new stops.
 */
export const updateOwnerTripLineStops = (ownerId: string, lineId: string, stops: LineStopInput[], opts?: NotifyOptions, pricing?: { fares?: FareInput[]; expectedPricingRevision: number }) =>
  notifyResult(
    t("tripLines.toast.stopsSaved"),
    apiSend<TripLine>(`${lineBase(ownerId)}/${lineId}/stops`, "PATCH", { stops, ...pricing }),
    opts,
  );

export const deleteOwnerTripLine = (ownerId: string, id: string) =>
  notifyResult(t("tripLines.toast.deleted"), apiSend<null>(`${lineBase(ownerId)}/${id}`, "DELETE"));

/** Super-admin cross-owner line index (`GET /fleet-owners/trip-lines`). */
export const fetchSystemTripLinesPage = (cursor: string | null) => {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<CursorPage<TripLineListItem>>(`/api/fleet-owners/trip-lines${q}`);
};

/**
 * Resolves the ownerId that owns a given trip line by scanning the cross-owner line index.
 */
export async function findOwnerByLineId(lineId: string): Promise<string | null> {
  let cursor: string | null = null;
  for (let page = 0; page < 10; page++) {
    const res = await fetchSystemTripLinesPage(cursor);
    if (!res.ok) break;
    const line = res.data.items.find((l) => l.id === lineId);
    if (line?.ownerId) return line.ownerId;
    cursor = res.data.nextCursor;
    if (!cursor) break;
  }
  return null;
}

export type { ActionResult };

export type FareTable = { lineId: string; lastUpdated?: string | null; pricingRevision: number; pricingEnabled: boolean; complete: boolean; pairs: (FarePair & { unitFare: string | null; protectedForStopEdits?: boolean })[]; fares: FareInput[] };
export const fetchLineFares = (ownerId: string, lineId: string) => apiGet<FareTable>(`${lineBase(ownerId)}/${lineId}/fares`);
export const saveLineFares = (ownerId: string, lineId: string, input: { expectedPricingRevision: number; fares: FareInput[] }, opts?: NotifyOptions) => notifyResult(t("tripLines.toast.saved"), apiSend<FareTable>(`${lineBase(ownerId)}/${lineId}/fares`, "PUT", input), opts);
