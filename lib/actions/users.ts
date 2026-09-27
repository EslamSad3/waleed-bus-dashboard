import { apiGet, apiSend, apiSendFile, type ActionResult, type CursorPage } from "@/lib/actions/http";
import { notifyResult, type NotifyOptions } from "@/lib/actions/toast";

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
  notifyResult("اتضاف مستخدم الإدارة بنجاح", apiSend<AdminUser>("/api/users", "POST", input));
export const updateAdminUser = (id: string, input: { name?: string; isActive?: boolean; password?: string; maxBookingSeats?: number | null }) =>
  notifyResult(
    input.isActive === undefined ? "اتحفظت بيانات المستخدم" : input.isActive ? "تم تنشيط المستخدم" : "تم إيقاف المستخدم",
    apiSend<AdminUser>(`/api/users/${id}`, "PATCH", input),
  );
export const setAdminUserRoles = (id: string, roleSlugs: string[]) =>
  notifyResult("اتحدثت مستويات وصول المستخدم", apiSend<AdminUser>(`/api/users/${id}/roles`, "PUT", { roleSlugs }));
export const deleteAdminUser = (id: string) =>
  notifyResult("اتمسح المستخدم", apiSend<null>(`/api/users/${id}`, "DELETE"));
/** Multipart upload: the picture goes up as FormData and the API sets it (any user). */
export const uploadUserPicture = (id: string, file: File, opts?: NotifyOptions) =>
  notifyResult(
    "اترفعت صورة المستخدم",
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
