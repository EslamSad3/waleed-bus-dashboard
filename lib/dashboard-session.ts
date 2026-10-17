import { cookies } from "next/headers";
import { busFetch, type BusResult } from "@/lib/api";
import { ACCESS_COOKIE, identityFromValidatedToken, type SessionIdentity } from "@/lib/auth";
import { isDashboardRole, platformPermissions } from "@/lib/access";

/** Live admission shared by dashboard proxies; company API access is broader. */
export async function fetchDashboardSession(): Promise<BusResult<SessionIdentity>> {
  const result = await busFetch<{ id: string; platformPermissions?: unknown }>("/me");
  if (!result.ok) return result;
  // /me may rotate the access token. Authorize the exact token it validated.
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  const identity = accessToken ? identityFromValidatedToken(accessToken) : null;
  if (!identity || identity.id !== result.data?.id) {
    return { ok: false, status: 401, code: "AUTHENTICATION_FAILED" };
  }
  if (!isDashboardRole(identity.appRole)) {
    return { ok: false, status: 403, code: "FORBIDDEN" };
  }
  return { ok: true, status: 200, data: { ...identity, permissions: platformPermissions(result.data.platformPermissions) } };
}
