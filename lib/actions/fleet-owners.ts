import { apiDiscardStaged, apiGet, apiSend, apiSendFile, apiStageImage, type ActionResult, type CursorPage, type StagedUpload } from "@/lib/actions/http";
import { notifyResult, type NotifyOptions } from "@/lib/actions/toast";
import type { CreateFleetOwnerInput, UpdateFleetOwnerInput } from "@/lib/schemas/p1";
import { t } from "@/lib/i18n/t";

/**
 * An owner account IS the company: the payload carries the user, the VIP tier and
 * the owner's own ACTIVE membership — there is no nested fleet array and no
 * separate company name, the owner is identified by their own name.
 */
export type OwnerMembershipBrief = {
  id: string;
  roleSlug: string;
  status: "ACTIVE" | "SUSPENDED" | "REVOKED";
};

export type FleetOwnerAccount = {
  id: string;
  name: string | null;
  nickname: string | null;
  phoneNumber: string | null;
  picture: string | null;
  nationalId: string | null;
  vipTierId?: string | null;
  isActive: boolean;
  createdAt: string;
  membership: OwnerMembershipBrief | null;
};

export type FleetOwnerPage = CursorPage<FleetOwnerAccount>;

export function fetchFleetOwnersPage(cursor: string | null): Promise<ActionResult<FleetOwnerPage>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet(`/api/fleet-owners${query}`);
}

export function fetchFleetOwner(id: string): Promise<ActionResult<FleetOwnerAccount>> {
  return apiGet(`/api/fleet-owners/${id}`);
}

export function createFleetOwner(input: CreateFleetOwnerInput): Promise<ActionResult<FleetOwnerAccount>> {
  return notifyResult(t("fleetOwners.toast.created"), apiSend("/api/fleet-owners", "POST", input));
}

export function updateFleetOwner(id: string, input: UpdateFleetOwnerInput): Promise<ActionResult<FleetOwnerAccount>> {
  return notifyResult(t("fleetOwners.toast.saved"), apiSend(`/api/fleet-owners/${id}`, "PATCH", input));
}

export function deleteFleetOwner(id: string): Promise<ActionResult<null>> {
  return notifyResult(t("fleetOwners.toast.deleted"), apiSend(`/api/fleet-owners/${id}`, "DELETE"));
}

/** The caller's own profile plus their ACTIVE owner memberships (tenant selectors). */
export type MyOwnerMembership = {
  ownerId: string;
  ownerName: string;
  membershipId: string;
  roleSlug: string;
  status: string;
};

export type MyOwner = {
  id: string;
  name: string | null;
  picture?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  memberships: MyOwnerMembership[];
};

export function fetchMyOwner(): Promise<ActionResult<MyOwner>> {
  return apiGet<MyOwner>("/api/fleet-owners/me");
}

/**
 * Stage an owner picture via direct browser→Supabase upload (Vercel-safe).
 * Link `staged.publicUrl` as `picture` on create/update, and call
 * `discardFleetOwnerPicture` when the user cancels or the record write fails.
 */
export function stageFleetOwnerPicture(file: File, userId?: string, signal?: AbortSignal): Promise<ActionResult<StagedUpload>> {
  return apiStageImage("fleet-owner-picture", file, userId ? { userId } : {}, signal);
}

/** Best-effort cleanup of a staged picture (cancel / failed record write). */
export function discardFleetOwnerPicture(staged: StagedUpload): Promise<void> {
  return apiDiscardStaged(staged);
}

/**
 * @deprecated Use stageFleetOwnerPicture + picture URL instead. The legacy
 * multipart path proxies file bytes through Vercel and 503s under load.
 */
export function uploadFleetOwnerPicture(id: string, file: File, opts?: NotifyOptions): Promise<ActionResult<{ url: string }>> {
  return notifyResult(
    t("fleetOwners.toast.imageUploaded"),
    apiSendFile<{ url: string }>(`/api/fleet-owners/${id}/picture`, file),
    opts,
  );
}

/** Owner picker options (read-only reuse of `GET /users`). */
export type UserOption = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  phoneNumber?: string | null;
};

export function fetchUserOptions(): Promise<ActionResult<{ items: UserOption[] }>> {
  return apiGet("/api/users?limit=100");
}

/**
 * ownerId → owner display name, for the cross-owner indexes that only carry the
 * id (buses, trip lines). One call beats a request per row.
 *
 * Returned as `[id, name]` tuples, NOT a Map: this is a server action, and the
 * RSC boundary only carries JSON-serialisable values, so a Map reaches the
 * client as `{}` and every `.get()`/`.keys()` on it throws. Callers rebuild the
 * Map with useMemo.
 */
export async function fetchOwnerNameMap(): Promise<ActionResult<Array<[string, string]>>> {
  const page = await fetchFleetOwnersPage(null);
  if (!page.ok) return page;
  return {
    ok: true,
    data: page.data.items.map((owner) => [
      owner.id,
      owner.name || owner.nickname || owner.phoneNumber || owner.id,
    ]),
  };
}
