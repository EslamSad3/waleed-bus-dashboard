import { apiGet, apiSend, type ActionResult, type CursorPage } from "@/lib/actions/http";
import { notifyResult } from "@/lib/actions/toast";
import type { CreateFleetInput } from "@/lib/schemas/p1";
import { t } from "@/lib/i18n/t";

export type VipTier = {
  id: string;
  name: string;
  rank: number;
  isActive: boolean;
};

export type Fleet = {
  id: string;
  name: string;
  ownerId: string;
  isActive: boolean;
  vipTierId?: string | null;
  vipTier?: VipTier | null;
  createdAt: string;
  updatedAt: string;
};

export type FleetPage = CursorPage<Fleet>;

export function fetchFleetsPage(cursor: string | null): Promise<ActionResult<FleetPage>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<FleetPage>(`/api/fleets${q}`);
}

export function fetchFleet(id: string): Promise<ActionResult<Fleet>> {
  return apiGet<Fleet>(`/api/fleets/${id}`);
}

export function createFleet(input: CreateFleetInput): Promise<ActionResult<Fleet>> {
  return notifyResult(t("fleets.toast.created"), apiSend<Fleet>("/api/fleets", "POST", input, "OWNER_LINK"));
}

export function updateFleet(id: string, input: { name?: string; isActive?: boolean }): Promise<ActionResult<Fleet>> {
  return notifyResult(
    input.isActive === undefined ? t("fleets.toast.saved") : input.isActive ? t("fleets.toast.activated") : t("fleets.toast.deactivated"),
    apiSend<Fleet>(`/api/fleets/${id}`, "PATCH", input),
  );
}

export function deleteFleet(id: string): Promise<ActionResult<null>> {
  return notifyResult(t("fleets.toast.deleted"), apiSend<null>(`/api/fleets/${id}`, "DELETE", undefined, "FLEET_REFERENCED"));
}

export function assignFleetVip(id: string, vipTierId: string | null): Promise<ActionResult<Fleet>> {
  return notifyResult(
    vipTierId ? t("fleets.toast.vipUpdated") : t("fleets.toast.vipCleared"),
    apiSend<Fleet>(`/api/fleets/${id}/vip`, "PATCH", { vipTierId }),
  );
}

export const fetchVipTiers = (includeInactive = false) =>
  apiGet<VipTier[]>(`/api/vip-tiers${includeInactive ? "?includeInactive=true" : ""}`);
export const createVipTier = (input: { name: string; rank: number; isActive?: boolean }) =>
  notifyResult(t("vipTiers.toast.created"), apiSend<VipTier>("/api/vip-tiers", "POST", input));
export const updateVipTier = (id: string, input: { name?: string; rank?: number; isActive?: boolean }) =>
  notifyResult(
    input.isActive === undefined ? t("vipTiers.toast.saved") : input.isActive ? t("vipTiers.toast.activated") : t("vipTiers.toast.deactivated"),
    apiSend<VipTier>(`/api/vip-tiers/${id}`, "PATCH", input),
  );
export const deleteVipTier = (id: string) =>
  notifyResult(t("vipTiers.toast.deleted"), apiSend<null>(`/api/vip-tiers/${id}`, "DELETE"));

/** Owner picker (read-only reuse of GET /users per research R7). */
export function fetchUserOptions(): Promise<ActionResult<{ items: { id: string; name?: string | null; email?: string | null; phone?: string | null; phoneNumber?: string | null }[] }>> {
  return apiGet("/api/users?limit=100");
}
