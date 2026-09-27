import { apiDiscardStaged, apiGet, apiSend, apiSendFile, apiStageImage, type ActionResult, type CursorPage, type StagedUpload } from "@/lib/actions/http";
import { notifyResult, type NotifyOptions } from "@/lib/actions/toast";
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
  return notifyResult("اتضاف مالك العربية بنجاح", apiSend("/api/fleet-owners", "POST", input));
}

export function updateFleetOwner(id: string, input: UpdateFleetOwnerInput): Promise<ActionResult<FleetOwnerAccount>> {
  return notifyResult("اتحفظت بيانات صاحب العربية", apiSend(`/api/fleet-owners/${id}`, "PATCH", input));
}

export function deleteFleetOwner(id: string): Promise<ActionResult<null>> {
  return notifyResult("اتمسح صاحب العربية", apiSend(`/api/fleet-owners/${id}`, "DELETE"));
}

/**
 * Stage a fleet-owner picture via direct browser→Supabase upload (Vercel-safe).
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
    "اترفعت صورة مالك العربية",
    apiSendFile<{ url: string }>(`/api/fleet-owners/${id}/picture`, file),
    opts,
  );
}
