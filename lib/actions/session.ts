import { apiGet, type ActionResult } from "@/lib/actions/http";
import type { DashboardAccess } from "@/lib/access";

/** Session identity for client-side permission gating (reuses GET /api/auth/me). */
export type SessionIdentity = DashboardAccess & {
  id: string;
  email: string | null;
};

export function fetchSessionIdentity(): Promise<ActionResult<SessionIdentity>> {
  return apiGet<SessionIdentity>("/api/auth/me");
}
