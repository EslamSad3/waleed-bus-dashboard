import { apiGet, apiSend, type ActionResult, type CursorPage } from "@/lib/actions/http";
import type { CreateFleetOwnerInput, UpdateFleetOwnerInput } from "@/lib/schemas/p1";

export type FleetOwnerAccount = {
  id: string;
  name: string | null;
  nickname: string | null;
  phoneNumber: string | null;
  picture: string | null;
  nationalId: string | null;
  isActive: boolean;
  createdAt: string;
  fleets: { id: string; name: string; isActive: boolean }[];
};

export function fetchFleetOwnersPage(cursor: string | null): Promise<ActionResult<CursorPage<FleetOwnerAccount>>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet(`/api/fleet-owners${query}`);
}

export function fetchFleetOwner(id: string): Promise<ActionResult<FleetOwnerAccount>> {
  return apiGet(`/api/fleet-owners/${id}`);
}

export function createFleetOwner(input: CreateFleetOwnerInput): Promise<ActionResult<FleetOwnerAccount>> {
  return apiSend("/api/fleet-owners", "POST", input);
}

export function updateFleetOwner(id: string, input: UpdateFleetOwnerInput): Promise<ActionResult<FleetOwnerAccount>> {
  return apiSend(`/api/fleet-owners/${id}`, "PATCH", input);
}
