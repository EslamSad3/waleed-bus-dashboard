import { apiGet, apiSend, type ActionResult, type CursorPage } from "@/lib/actions/http";
import { notifyResult } from "@/lib/actions/toast";
import type { AddMemberInput, AddDriverInput } from "@/lib/schemas/p1";
import type { DriverRatingRow, DriverTripRow, TripFeedbackRow } from "@/lib/actions/feedback";
import { fetchDriverRatingsPage, fetchDriverTripsPage } from "@/lib/actions/feedback";
import { t } from "@/lib/i18n/t";

const ownerBase = (ownerId: string) => `/api/fleet-owners/${ownerId}`;

export type Member = {
  id: string;
  userId: string;
  ownerId: string;
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
  ACTIVE: t("enums.memberStatus.active"),
  SUSPENDED: t("enums.memberStatus.suspended"),
  REVOKED: t("enums.memberStatus.revoked"),
};

/** Driver stats embedded by the roster detail endpoint. */
export type DriverStats = {
  tripCount: number;
  overallRating: number | null;
  uniqueBusCount: number;
};

/** Roster row. Driver subresources are keyed by the DRIVER USER id. */
export type DriverRow = {
  /** Membership row id. */
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
  stats?: DriverStats;
  assignments?: {
    id: string;
    busId: string;
    registrationNumber: string;
    plateNumber?: string | null;
    status: string;
    createdAt: string;
    endedAt: string | null;
  }[];
};

/** Cross-owner roster row: the driver membership plus its company and active bus. */
export type SystemDriverRow = DriverRow & {
  owner: { id: string; name: string | null; phoneNumber: string | null };
  assignedBus: { id: string; registrationNumber: string; plateNumber: string | null } | null;
};

export type DriverAssignmentRow = {
  id: string;
  busId: string;
  registrationNumber: string;
  plateNumber: string | null;
  status: string;
  createdAt: string;
  endedAt: string | null;
};

export type DriverPage = CursorPage<DriverRow>;

export function fetchMembersPage(ownerId: string, cursor: string | null): Promise<ActionResult<MemberPage>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<MemberPage>(`${ownerBase(ownerId)}/members${q}`);
}

export function addMember(ownerId: string, input: AddMemberInput): Promise<ActionResult<Member>> {
  return notifyResult(
    t("members.toast.added"),
    apiSend<Member>(`${ownerBase(ownerId)}/members`, "POST", input, "MEMBER_EXISTS"),
  );
}

export function updateMember(ownerId: string, memberId: string, input: { roleSlug?: string; status?: Member["status"] }): Promise<ActionResult<Member>> {
  return notifyResult(
    input.status === "ACTIVE"
      ? t("members.toast.activated")
      : input.status === "SUSPENDED"
        ? t("members.toast.suspended")
        : input.status === "REVOKED"
          ? t("members.toast.revoked")
          : t("members.toast.saved"),
    apiSend<Member>(`${ownerBase(ownerId)}/members/${memberId}`, "PATCH", input),
  );
}

export function removeMember(ownerId: string, memberId: string): Promise<ActionResult<null>> {
  return notifyResult(
    t("members.toast.removed"),
    apiSend<null>(`${ownerBase(ownerId)}/members/${memberId}`, "DELETE"),
  );
}

/** Owner driver roster. */
export function fetchDriversPage(ownerId: string, cursor: string | null): Promise<ActionResult<DriverPage>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<DriverPage>(`${ownerBase(ownerId)}/drivers${q}`);
}

/** Super-admin cross-owner roster (`GET /fleet-owners/drivers`). */
export function fetchSystemDriversPage(cursor: string | null): Promise<ActionResult<CursorPage<SystemDriverRow>>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<CursorPage<SystemDriverRow>>(`/api/fleet-owners/drivers${q}`);
}

export function inviteDriver(ownerId: string, input: AddDriverInput): Promise<ActionResult<DriverRow>> {
  return notifyResult(
    t("members.toast.inviteSent"),
    apiSend<DriverRow>(`${ownerBase(ownerId)}/drivers`, "POST", input, "MEMBER_EXISTS"),
  );
}

export function fetchDriver(ownerId: string, driverUserId: string): Promise<ActionResult<DriverRow>> {
  return apiGet<DriverRow>(`${ownerBase(ownerId)}/drivers/${driverUserId}`);
}

export function updateDriver(
  ownerId: string,
  driverUserId: string,
  input: {
    roleSlug?: string;
    status?: Member["status"];
    name?: string;
    nickname?: string;
    phone?: string;
    nationalId?: string;
    password?: string;
    picture?: string;
  },
): Promise<ActionResult<DriverRow>> {
  return notifyResult(
    input.status === "ACTIVE"
      ? t("members.toast.driverActivated")
      : input.status === "SUSPENDED"
        ? t("members.toast.driverSuspended")
        : input.status === "REVOKED"
          ? t("members.toast.driverRevoked")
          : t("members.toast.driverSaved"),
    apiSend<DriverRow>(`${ownerBase(ownerId)}/drivers/${driverUserId}`, "PATCH", input),
  );
}

export function removeDriver(ownerId: string, driverUserId: string): Promise<ActionResult<null>> {
  return notifyResult(
    t("members.toast.driverDeleted"),
    apiSend<null>(`${ownerBase(ownerId)}/drivers/${driverUserId}`, "DELETE"),
  );
}

/** Bus-assignment history for one driver, scoped to this owner company. */
export function fetchDriverAssignmentsPage(
  ownerId: string,
  driverUserId: string,
  cursor: string | null,
): Promise<ActionResult<CursorPage<DriverAssignmentRow>>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiGet<CursorPage<DriverAssignmentRow>>(
    `${ownerBase(ownerId)}/drivers/${driverUserId}/assignments${q}`,
  );
}

/** Trips the driver operated (snapshot) with per-trip rating averages. */
export function fetchDriverTripRowsPage(
  ownerId: string,
  driverUserId: string,
  cursor: string | null,
): Promise<ActionResult<CursorPage<DriverTripRow>>> {
  return fetchDriverTripsPage(ownerId, driverUserId, cursor);
}

/** Every driver rating + comment for this owner company. */
export function fetchDriverRatingRowsPage(
  ownerId: string,
  driverUserId: string,
  cursor: string | null,
): Promise<ActionResult<CursorPage<DriverRatingRow>>> {
  return fetchDriverRatingsPage(ownerId, driverUserId, cursor);
}

/** Role picker (read-only reuse of GET /roles per research R7). */
export function fetchRoleOptions(): Promise<ActionResult<{ items: { id: string; slug: string; name?: string | null }[] }>> {
  return apiGet("/api/roles?limit=100");
}

export type { TripFeedbackRow };
