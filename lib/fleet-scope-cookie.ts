/** Fleet-scope cookie: persisted working fleet, sent as `x-fleet-id` on tenant-path calls. */
export const FLEET_SCOPE_COOKIE = "fleet_scope";

export function setFleetScopeCookie(id: string | null): void {
  document.cookie = id
    ? `${FLEET_SCOPE_COOKIE}=${encodeURIComponent(id)}; Path=/; SameSite=Lax; Max-Age=31536000`
    : `${FLEET_SCOPE_COOKIE}=; Path=/; Max-Age=0`;
}
