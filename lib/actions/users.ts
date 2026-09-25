import { apiGet, apiSend, type ActionResult, type CursorPage } from "@/lib/actions/http";

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
export const createAdminUser = (input: { email: string; password: string; name?: string; globalRoleSlugs?: string[] }) => apiSend<AdminUser>("/api/users", "POST", input);
export const updateAdminUser = (id: string, input: { name?: string; isActive?: boolean; password?: string; maxBookingSeats?: number | null }) => apiSend<AdminUser>(`/api/users/${id}`, "PATCH", input);
export const setAdminUserRoles = (id: string, roleSlugs: string[]) => apiSend<AdminUser>(`/api/users/${id}/roles`, "PUT", { roleSlugs });
export const deleteAdminUser = (id: string) => apiSend<null>(`/api/users/${id}`, "DELETE");

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
