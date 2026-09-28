import { apiGet, apiSend, type ActionResult, type CursorPage } from "@/lib/actions/http";
import { notifyResult } from "@/lib/actions/toast";
import { t } from "@/lib/i18n/t";

export type Permission = {
  id: string;
  key: string;
  resource: string;
  action: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
};

export function fetchPermissionsPage(cursor: string | null): Promise<ActionResult<CursorPage<Permission>>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<CursorPage<Permission>>(`/api/permissions${query}`);
}

/** Retrieves the complete catalog for role assignment, following opaque cursors. */
export async function fetchPermissionCatalog(): Promise<ActionResult<Permission[]>> {
  const items: Permission[] = [];
  let cursor: string | null = null;
  do {
    const result = await fetchPermissionsPage(cursor);
    if (!result.ok) return result;
    items.push(...result.data.items);
    cursor = result.data.nextCursor;
  } while (cursor);
  return { ok: true, data: items };
}

export function createPermission(input: { key: string; resource: string; action: string; description?: string }): Promise<ActionResult<Permission>> {
  return notifyResult(t("permissions.toast.created"), apiSend<Permission>("/api/permissions", "POST", input));
}

export function updatePermission(id: string, input: { description?: string; isActive?: boolean }): Promise<ActionResult<Permission>> {
  return notifyResult(
    input.isActive === undefined
      ? t("permissions.toast.saved")
      : input.isActive
        ? t("permissions.toast.activated")
        : t("permissions.toast.deactivated"),
    apiSend<Permission>(`/api/permissions/${id}`, "PATCH", input),
  );
}
