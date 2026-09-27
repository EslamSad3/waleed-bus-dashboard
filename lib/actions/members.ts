import { apiGet, apiSend, type ActionResult, type CursorPage } from "@/lib/actions/http";
import { notifyResult } from "@/lib/actions/toast";
import type { AddMemberInput, AddDriverInput } from "@/lib/schemas/p1";

export type Member = {
  id: string;
  userId: string;
  fleetId: string;
  roleId: string;
  status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  joinedAt: string;
  assignedBy?: string | null;
  /** Included by the members list endpoint for the dashboard grid. */
  user?: { id: string; name: string | null; nickname: string | null; phoneNumber: string | null } | null;
  role?: { slug: string; name: string | null } | null;
  assignedByUser?: { id: string; name: string | null } | null;
};

export type MemberPage = CursorPage<Member>;

export const MEMBER_STATUS_AR: Record<Member["status"], string> = {
  ACTIVE: "نشط",
  SUSPENDED: "موقوف",
  REVOKED: "ملغي الصلاحية",
};

/** Driver roster row — fields beyond id/status render defensively (backend-owned shape). */
export type DriverRow = {
  id: string;
  userId?: string;
  name?: string | null;
  nickname?: string | null;
  phoneNumber?: string | null;
  picture?: string | null;
  nationalId?: string | null;
  status: string;
  roleSlug?: string | null;
  joinedAt?: string;
  assignments?: { id: string; busId: string; registrationNumber: string; status: string; createdAt: string; endedAt: string | null }[];
};

/** Platform roster row: one driver membership plus its fleet ownership and active bus context. */
export type SystemDriverRow = DriverRow & {
  fleet: { id: string; name: string };
  fleetOwner: { id: string; name: string | null; phoneNumber: string | null };
  assignedBus: { id: string; registrationNumber: string; plateNumber: string | null } | null;
};

export function fetchMembersPage(fleetId: string, cursor: string | null): Promise<ActionResult<MemberPage>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<MemberPage>(`/api/fleets/${fleetId}/members${q}`);
}

export function addMember(fleetId: string, input: AddMemberInput): Promise<ActionResult<Member>> {
  return notifyResult(
    "اتضاف العضو للأسطول",
    apiSend<Member>(`/api/fleets/${fleetId}/members`, "POST", input, "MEMBER_EXISTS"),
  );
}

export function updateMember(fleetId: string, memberId: string, input: { roleSlug?: string; status?: Member["status"] }): Promise<ActionResult<Member>> {
  return notifyResult(
    input.status === "ACTIVE"
      ? "تم تنشيط العضو"
      : input.status === "SUSPENDED"
        ? "تم إيقاف العضو"
        : input.status === "REVOKED"
          ? "تم إلغاء صلاحية العضو"
          : "اتحفظت بيانات العضو",
    apiSend<Member>(`/api/fleets/${fleetId}/members/${memberId}`, "PATCH", input),
  );
}

export function removeMember(fleetId: string, memberId: string): Promise<ActionResult<null>> {
  return notifyResult(
    "اتمسح العضو من الأسطول",
    apiSend<null>(`/api/fleets/${fleetId}/members/${memberId}`, "DELETE"),
  );
}

/** Tenant driver roster (research R1) — fleetId sent as x-fleet-id. */
export function fetchDriversPage(fleetId: string, cursor: string | null): Promise<ActionResult<CursorPage<DriverRow>>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet(`/api/fleet/drivers${q}`, fleetId);
}

export function fetchSystemDriversPage(cursor: string | null): Promise<ActionResult<CursorPage<SystemDriverRow>>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet(`/api/drivers${q}`);
}

export function inviteDriver(fleetId: string, input: AddDriverInput): Promise<ActionResult<DriverRow>> {
  return notifyResult(
    "اتبعتت دعوة السواق بنجاح",
    apiSend(`/api/fleet/drivers`, "POST", input, "MEMBER_EXISTS", fleetId),
  );
}

export function fetchDriver(fleetId: string, driverId: string): Promise<ActionResult<DriverRow>> {
  return apiGet(`/api/fleet/drivers/${driverId}`, fleetId);
}

export function updateDriver(
  fleetId: string,
  driverId: string,
  input: {
    roleSlug?: string;
    status?: Member["status"];
    name?: string;
    nickname?: string;
    phone?: string;
    nationalId?: string;
    password?: string;
  },
): Promise<ActionResult<DriverRow>> {
  return notifyResult(
    input.status === "ACTIVE"
      ? "تم تنشيط السواق"
      : input.status === "SUSPENDED"
        ? "تم إيقاف السواق"
        : input.status === "REVOKED"
          ? "تم إلغاء صلاحية السواق"
          : "اتحفظت بيانات السواق",
    apiSend(`/api/fleet/drivers/${driverId}`, "PATCH", input, undefined, fleetId),
  );
}

export function removeDriver(fleetId: string, driverId: string): Promise<ActionResult<null>> {
  return notifyResult(
    "اتمسح السواق",
    apiSend<null>(`/api/fleet/drivers/${driverId}`, "DELETE", undefined, undefined, fleetId),
  );
}

/** Role picker (read-only reuse of GET /roles per research R7). */
export function fetchRoleOptions(): Promise<ActionResult<{ items: { id: string; slug: string; name?: string | null }[] }>> {
  return apiGet("/api/roles?limit=100");
}
