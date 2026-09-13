import { apiGet, apiSend, type ActionResult, type CursorPage } from "@/lib/actions/http";

export type Role = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
};

export type RoleDetail = Role & {
  rolePermissions: { permission: { key: string; description?: string | null } }[];
};

export function fetchRolesPage(cursor: string | null): Promise<ActionResult<CursorPage<Role>>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<CursorPage<Role>>(`/api/roles${query}`);
}

export function fetchRole(id: string): Promise<ActionResult<RoleDetail>> {
  return apiGet<RoleDetail>(`/api/roles/${id}`);
}

export function createRole(input: { name: string; slug: string; description?: string }): Promise<ActionResult<Role>> {
  return apiSend<Role>("/api/roles", "POST", input);
}

export function updateRole(id: string, input: { name?: string; description?: string; isActive?: boolean }): Promise<ActionResult<Role>> {
  return apiSend<Role>(`/api/roles/${id}`, "PATCH", input);
}

export function replaceRolePermissions(id: string, permissionKeys: string[]): Promise<ActionResult<Role>> {
  return apiSend<Role>(`/api/roles/${id}/permissions`, "PUT", { permissionKeys });
}
