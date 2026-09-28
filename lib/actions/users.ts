import { apiDiscardStaged, apiGet, apiSend, apiSendFile, apiStageImage, type ActionResult, type CursorPage, type StagedUpload } from "@/lib/actions/http";
import { notifyResult, type NotifyOptions } from "@/lib/actions/toast";
import { t } from "@/lib/i18n/t";

export type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  maxBookingSeats?: number | null;
  effectiveMaxBookingSeats?: number;
  isActive: boolean;
  authVersion: number;
  createdAt: string;
  updatedAt: string;
  globalRoles?: { role: { id: string; slug: string; name: string } }[];
};

export const PLATFORM_DEFAULT_MAX_BOOKING_SEATS = 5;

export function fetchAdminUsers(cursor: string | null): Promise<ActionResult<CursorPage<AdminUser>>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=30` : "?limit=30";
  return apiGet<CursorPage<AdminUser>>(`/api/users${query}`);
}

export const fetchAdminUser = (id: string) => apiGet<AdminUser>(`/api/users/${id}`);
export const createAdminUser = (input: { email: string; password: string; name?: string; globalRoleSlugs?: string[] }) =>
  notifyResult(t("users.toast.created"), apiSend<AdminUser>("/api/users", "POST", input));
export const updateAdminUser = (id: string, input: { name?: string; isActive?: boolean; password?: string; maxBookingSeats?: number | null }) =>
  notifyResult(
    input.isActive === undefined ? t("users.toast.saved") : input.isActive ? t("users.toast.activated") : t("users.toast.deactivated"),
    apiSend<AdminUser>(`/api/users/${id}`, "PATCH", input),
  );
export const setAdminUserRoles = (id: string, roleSlugs: string[]) =>
  notifyResult(t("users.toast.rolesUpdated"), apiSend<AdminUser>(`/api/users/${id}/roles`, "PUT", { roleSlugs }));
export const deleteAdminUser = (id: string) =>
  notifyResult(t("users.toast.deleted"), apiSend<null>(`/api/users/${id}`, "DELETE"));
/**
 * Stage a user/driver picture via direct browser→Supabase upload (Vercel-safe).
 * The caller links the returned `publicUrl` on its own record update, and MUST
 * discard the staged object on cancel / failed writes.
 */
export const stageUserPicture = (file: File, userId?: string, signal?: AbortSignal) =>
  apiStageImage("user-picture", file, userId ? { userId } : {}, signal);

export const discardUserPicture = (staged: StagedUpload) => apiDiscardStaged(staged);

/**
 * @deprecated Use stageUserPicture instead. The legacy multipart path proxies
 * file bytes through Vercel and 503s under load.
 */
export const uploadUserPicture = (id: string, file: File, opts?: NotifyOptions) =>
  notifyResult(
    t("users.toast.imageUploaded"),
    apiSendFile<{ url: string }>(`/api/users/${id}/picture`, file),
    opts,
  );

export type TargetOption = {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
};

/** Eligible promotion targets: active passenger accounts, server-side search (name/email/phone). */
export function fetchTargetOptions(q: string): Promise<ActionResult<TargetOption[]>> {
  const query = q.trim()
    ? `?q=${encodeURIComponent(q.trim())}&limit=30`
    : "?limit=30";
  return apiGet<TargetOption[]>(`/api/users/target-options${query}`);
}
