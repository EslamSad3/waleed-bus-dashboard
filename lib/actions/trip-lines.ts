import { apiGet, apiSend, type ActionResult } from "@/lib/actions/http";

export type Stop = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
};

export type TripLineStop = {
  id: string;
  stopOrder: number;
  estimatedStopMinutes?: number | null;
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
export const fetchStop = (id: string) => apiGet<Stop>(`/api/stops/${id}`);
export const createStop = (input: Omit<Stop, "id">) => apiSend<Stop>("/api/stops", "POST", input);
export const updateStop = (id: string, input: Partial<Omit<Stop, "id">>) => apiSend<Stop>(`/api/stops/${id}`, "PATCH", input);
export const deleteStop = (id: string) => apiSend<null>(`/api/stops/${id}`, "DELETE");

export const fetchTripLines = () => apiGet<TripLine[]>("/api/trip-lines");
export const fetchTripLine = (id: string) => apiGet<TripLine>(`/api/trip-lines/${id}`);
export const createTripLine = (input: { name: string; code: string; isActive?: boolean; outboundStops: { stopId: string; estimatedStopMinutes?: number }[]; returnStops: { stopId: string; estimatedStopMinutes?: number }[] }) => apiSend<TripLine>("/api/trip-lines", "POST", input);
export const updateTripLine = (id: string, input: { name?: string; code?: string; isActive?: boolean }) => apiSend<TripLine>(`/api/trip-lines/${id}`, "PATCH", input);
export const updateTripLineDirectionStops = (lineId: string, directionId: string, stops: { stopId: string; estimatedStopMinutes?: number }[]) => apiSend<TripLine>(`/api/trip-lines/${lineId}/directions/${directionId}/stops`, "PATCH", { stops });
export const deleteTripLine = (id: string) => apiSend<null>(`/api/trip-lines/${id}`, "DELETE");

export type { ActionResult };
