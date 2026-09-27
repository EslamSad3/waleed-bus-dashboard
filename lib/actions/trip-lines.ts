import { apiGet, apiSend, type ActionResult } from "@/lib/actions/http";
import { notifyResult } from "@/lib/actions/toast";

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

export type TripLineStop = {
  id: string;
  stopOrder: number;
  estimatedStopMinutes?: number | null;
  stopType: "BOARDING" | "LANDING" | "BOTH";
  station: Stop;
};

export type TripLine = {
  id: string;
  name: string;
  code: string;
  origin: string;
  destination: string;
  stations: TripLineStop[];
  isActive: boolean;
  directions: { id: string; direction: "OUTBOUND" | "RETURN"; origin: string; destination: string; stations: TripLineStop[] }[];
};

export const fetchStops = () => apiGet<Stop[]>("/api/stops");
export const fetchGovernorates = () => apiGet<Governorate[]>("/api/governorates");
export const fetchMarkaz = (governorateId: string, includeInactive = false) =>
  apiGet<Markaz[]>(`/api/governorates/${governorateId}/markaz${includeInactive ? "?includeInactive=true" : ""}`);
export const fetchMarkazAll = (includeInactive = true) =>
  apiGet<Markaz[]>(`/api/markaz${includeInactive ? "?includeInactive=true" : ""}`);
export const fetchMarkazById = (id: string) => apiGet<Markaz>(`/api/markaz/${id}`);
export const createMarkaz = (input: { governorateId: string; code: string; nameAr: string; nameEn: string; isActive?: boolean }) =>
  notifyResult("اتضاف المركز بنجاح", apiSend<Markaz>("/api/markaz", "POST", input));
export const updateMarkaz = (id: string, input: { nameAr?: string; nameEn?: string; isActive?: boolean }) =>
  notifyResult(
    input.isActive === undefined ? "اتحفظت بيانات المركز" : input.isActive ? "تم تنشيط المركز" : "تم إيقاف المركز",
    apiSend<Markaz>(`/api/markaz/${id}`, "PATCH", input),
  );
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
  notifyResult("اتضافت المدينة/القرية بنجاح", apiSend<Locality>("/api/localities", "POST", input));
export const updateLocality = (id: string, input: { nameAr?: string; nameEn?: string; isActive?: boolean }) =>
  notifyResult(
    input.isActive === undefined
      ? "اتحفظت بيانات المدينة/القرية"
      : input.isActive
        ? "تم تنشيط المدينة/القرية"
        : "تم إيقاف المدينة/القرية",
    apiSend<Locality>(`/api/localities/${id}`, "PATCH", input),
  );
export const fetchStop = (id: string) => apiGet<Stop>(`/api/stops/${id}`);
export type StopInput = Omit<Stop, "id" | "governorate">;
export const createStop = (input: StopInput) =>
  notifyResult("اتضافت نقطة التوقف بنجاح", apiSend<Stop>("/api/stops", "POST", input));
export const updateStop = (id: string, input: Partial<StopInput>) =>
  notifyResult("اتحفظت بيانات نقطة التوقف", apiSend<Stop>(`/api/stops/${id}`, "PATCH", input));
export const deleteStop = (id: string) =>
  notifyResult("اتمسحت نقطة التوقف", apiSend<null>(`/api/stops/${id}`, "DELETE"));

export const fetchTripLines = () => apiGet<TripLine[]>("/api/trip-lines");
export const fetchTripLine = (id: string) => apiGet<TripLine>(`/api/trip-lines/${id}`);
export const createTripLine = (input: { name: string; code: string; isActive?: boolean; outboundStops: { stopId: string; stopType: "BOARDING" | "LANDING"; estimatedStopMinutes?: number }[]; returnStops: { stopId: string; stopType: "BOARDING" | "LANDING"; estimatedStopMinutes?: number }[] }) =>
  notifyResult("اتضاف الخط بنجاح", apiSend<TripLine>("/api/trip-lines", "POST", input));
export const updateTripLine = (id: string, input: { name?: string; code?: string; isActive?: boolean }) =>
  notifyResult(
    input.isActive === undefined ? "اتحفظت بيانات الخط" : input.isActive ? "تم تنشيط الخط" : "تم إيقاف الخط",
    apiSend<TripLine>(`/api/trip-lines/${id}`, "PATCH", input),
  );
export const updateTripLineDirectionStops = (lineId: string, directionId: string, stops: { stopId: string; stopType: "BOARDING" | "LANDING"; estimatedStopMinutes?: number }[]) =>
  notifyResult(
    "اتحفظت محطات الخط",
    apiSend<TripLine>(`/api/trip-lines/${lineId}/directions/${directionId}/stops`, "PATCH", { stops }),
  );
export const deleteTripLine = (id: string) =>
  notifyResult("اتمسح الخط", apiSend<null>(`/api/trip-lines/${id}`, "DELETE"));

export type { ActionResult };
