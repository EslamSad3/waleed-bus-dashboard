import { apiGet, apiSend, type ActionResult, type CursorPage } from "@/lib/actions/http";
import { notifyResult } from "@/lib/actions/toast";
import type { CreateFleetInput } from "@/lib/schemas/p1";
import { t } from "@/lib/i18n/t";
import type { VipTier } from "@/lib/actions/vip-tiers";

export type { VipTier };

/** The owning account, embedded by `GET /fleet-owners/fleets` (spec 014). */
export type FleetOwnerRef = { id: string; name: string | null; phoneNumber: string | null };

export type Fleet = {
  id: string;
  name: string;
  ownerId: string;
  /** Present on list responses; the owner list nests the same rows. */
  owner?: FleetOwnerRef;
  isActive: boolean;
  vipTierId?: string | null;
  vipTier?: VipTier | null;
  createdAt: string;
  updatedAt: string;
};

export type FleetPage = CursorPage<Fleet>;

/** Platform fleet administration. All routes live under the fleet-owner namespace. */
const BASE = "/api/fleet-owners/fleets";

export function fetchFleetsPage(cursor: string | null): Promise<ActionResult<FleetPage>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<FleetPage>(`${BASE}${q}`);
}

export function fetchFleet(id: string): Promise<ActionResult<Fleet>> {
  return apiGet<Fleet>(`${BASE}/${id}`);
}

export function createFleet(input: CreateFleetInput): Promise<ActionResult<Fleet>> {
  return notifyResult(t("fleetOwners.fleets.toast.created"), apiSend<Fleet>(BASE, "POST", input, "OWNER_LINK"));
}

export function updateFleet(id: string, input: { name?: string; isActive?: boolean }): Promise<ActionResult<Fleet>> {
  return notifyResult(
    input.isActive === undefined ? t("fleetOwners.fleets.toast.saved") : input.isActive ? t("fleetOwners.fleets.toast.activated") : t("fleetOwners.fleets.toast.deactivated"),
    apiSend<Fleet>(`${BASE}/${id}`, "PATCH", input),
  );
}

export function deleteFleet(id: string): Promise<ActionResult<null>> {
  return notifyResult(t("fleetOwners.fleets.toast.deleted"), apiSend<null>(`${BASE}/${id}`, "DELETE", undefined, "FLEET_REFERENCED"));
}

export function assignFleetVip(id: string, vipTierId: string | null): Promise<ActionResult<Fleet>> {
  return notifyResult(
    vipTierId ? t("fleetOwners.fleets.toast.vipUpdated") : t("fleetOwners.fleets.toast.vipCleared"),
    apiSend<Fleet>(`${BASE}/${id}/vip`, "PATCH", { vipTierId }),
  );
}

/** Owner picker (read-only reuse of GET /users per research R7). */
export function fetchUserOptions(): Promise<ActionResult<{ items: { id: string; name?: string | null; email?: string | null; phone?: string | null; phoneNumber?: string | null }[] }>> {
  return apiGet("/api/users?limit=100");
}
