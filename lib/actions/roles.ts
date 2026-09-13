import { apiGet, type ActionResult, type CursorPage } from "@/lib/actions/http";

export type Role = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
};

export function fetchRolesPage(cursor: string | null): Promise<ActionResult<CursorPage<Role>>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<CursorPage<Role>>(`/api/roles${query}`);
}
