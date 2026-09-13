import { apiGet, type ActionResult, type CursorPage } from "@/lib/actions/http";

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
