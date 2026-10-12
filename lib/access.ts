import type { SessionIdentity } from "./auth";

export type DashboardAccess = Pick<SessionIdentity, "appRole" | "permissions">;

export function isDashboardRole(appRole: string | undefined): boolean {
  return appRole === "super_admin" || appRole === "platform_staff";
}

export function can(identity: DashboardAccess | null, key: string): boolean {
  return !!identity && (identity.appRole === "super_admin" ||
    (identity.appRole === "platform_staff" && identity.permissions.includes(key)));
}

export function platformPermissions(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((key): key is string => typeof key === "string") : [];
}
