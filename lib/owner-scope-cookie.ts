/** Owner-scope cookie: persisted working owner, sent as `x-owner-id` on owner-path calls. */
export const OWNER_SCOPE_COOKIE = "owner_scope";

export function setOwnerScopeCookie(id: string | null): void {
  document.cookie = id
    ? `${OWNER_SCOPE_COOKIE}=${encodeURIComponent(id)}; Path=/; SameSite=Lax; Max-Age=31536000`
    : `${OWNER_SCOPE_COOKIE}=; Path=/; Max-Age=0`;
}
