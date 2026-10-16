import {
  apiGet,
  apiSend,
  type ActionResult,
  type CursorPage,
} from "@/lib/actions/http";
import type { Trip } from "@/lib/actions/trips";
import { fetchFleetOwnersPage } from "@/lib/actions/fleet-owners";
import { t } from "@/lib/i18n/t";

export type SkippedOccurrence = {
  tripId: string;
  serviceDate: string;
  reason: "HAS_BOOKINGS" | "DETACHED" | string;
};

export type OccurrenceReport = {
  updated: number;
  removed: number;
  skipped: SkippedOccurrence[];
};

export type TripSchedule = {
  id: string;
  ownerId: string;
  lineId: string;
  busId: string;
  driverUserId: string;
  departTime: string;
  stopOffsetsMin: number[];
  daysOfWeek: number[];
  startsOn: string;
  endsOn: string | null;
  isActive: boolean;
  pausedReason: "LINE_STOPS_CHANGED" | "LINE_INACTIVE" | "BUS_INACTIVE" | string | null;
  materializedThrough: string | null;
  line: {
    id: string;
    name: string;
    nameEn?: string | null;
    code?: string | null;
  };
  bus: {
    id: string;
    registrationNumber?: string | null;
    plateNumber?: string | null;
  };
  driver: {
    id: string;
    name: string;
    phoneNumber?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  occurrences?: OccurrenceReport;
};

export type CreateTripScheduleInput = {
  busId: string;
  driverUserId: string;
  departTime: string;
  stopOffsetsMin: number[];
  daysOfWeek?: number[];
  startsOn?: string;
  endsOn?: string | null;
};

export type UpdateTripScheduleInput = Partial<CreateTripScheduleInput> & {
  isActive?: boolean;
};

export type ScheduleListFilters = {
  lineId?: string;
  busId?: string;
  driverUserId?: string;
  isActive?: boolean;
};

export type SystemTripSchedule = TripSchedule & { ownerName: string | null };

type ScheduleIndexCursor = {
  owners: { id: string; name: string | null }[];
  ownerCursor: string | null;
  directoryDone: boolean;
  scheduleCursor: string | null;
};

/**
 * The API currently exposes owner-scoped schedules only. Walk both real
 * cursors without loading every schedule into memory or issuing a fan-out.
 * Keep the remaining owner page in the continuation so later owner-directory
 * insertions do not shift an array offset and skip an owner.
 */
export async function fetchSystemSchedulesPage(
  cursor: string | null = null,
): Promise<ActionResult<CursorPage<SystemTripSchedule>>> {
  let state: ScheduleIndexCursor = {
    owners: [], ownerCursor: null, directoryDone: false, scheduleCursor: null,
  };
  if (cursor) {
    try {
      const parsed = JSON.parse(cursor) as ScheduleIndexCursor;
      if (!parsed || !Array.isArray(parsed.owners) ||
        !parsed.owners.every((owner) => owner && typeof owner.id === "string" &&
          (owner.name === null || typeof owner.name === "string")) ||
        typeof parsed.directoryDone !== "boolean" ||
        !(parsed.ownerCursor === null || typeof parsed.ownerCursor === "string") ||
        !(parsed.scheduleCursor === null || typeof parsed.scheduleCursor === "string")) {
        throw new Error("Invalid schedule index cursor");
      }
      state = parsed;
    } catch {
      return { ok: false, message: t("common.error.somethingWentWrong") };
    }
  }

  while (state.owners.length || !state.directoryDone) {
    if (!state.owners.length) {
      const owners = await fetchFleetOwnersPage(state.ownerCursor);
      if (!owners.ok) return owners;
      state.owners = owners.data.items.map(({ id, name }) => ({ id, name: name ?? null }));
      state.ownerCursor = owners.data.nextCursor;
      state.directoryDone = owners.data.nextCursor === null;
      if (!state.owners.length) continue;
    }

    const owner = state.owners[0];
    const schedules = await fetchOwnerSchedulesPage(owner.id, state.scheduleCursor);
    if (!schedules.ok) return schedules;
    state.scheduleCursor = schedules.data.nextCursor;
    if (!state.scheduleCursor) state.owners.shift();
    if (schedules.data.items.length) {
      return {
        ok: true,
        data: {
          items: schedules.data.items.map((schedule) => ({ ...schedule, ownerName: owner.name })),
          nextCursor: state.owners.length || !state.directoryDone ? JSON.stringify(state) : null,
        },
      };
    }
  }
  return { ok: true, data: { items: [], nextCursor: null } };
}

/** Fetch schedules across all lines of an owner company. */
export function fetchOwnerSchedulesPage(
  ownerId: string,
  cursor: string | null = null,
  filters: ScheduleListFilters = {},
): Promise<ActionResult<CursorPage<TripSchedule>>> {
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);
  if (filters.lineId) query.set("lineId", filters.lineId);
  if (filters.busId) query.set("busId", filters.busId);
  if (filters.driverUserId) query.set("driverUserId", filters.driverUserId);
  if (filters.isActive !== undefined) query.set("isActive", String(filters.isActive));
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiGet<CursorPage<TripSchedule>>(`/api/fleet-owners/${ownerId}/schedules${qs}`);
}

/** Fetch schedules of a specific trip line. */
export function fetchLineSchedulesPage(
  ownerId: string,
  lineId: string,
  cursor: string | null = null,
): Promise<ActionResult<CursorPage<TripSchedule>>> {
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiGet<CursorPage<TripSchedule>>(
    `/api/fleet-owners/${ownerId}/trip-lines/${lineId}/schedules${qs}`,
  );
}

/** Fetch one schedule detail. */
export function fetchSchedule(
  ownerId: string,
  lineId: string,
  scheduleId: string,
): Promise<ActionResult<TripSchedule>> {
  return apiGet<TripSchedule>(
    `/api/fleet-owners/${ownerId}/trip-lines/${lineId}/schedules/${scheduleId}`,
  );
}

/** Create a recurring trip schedule. */
export function createSchedule(
  ownerId: string,
  lineId: string,
  input: CreateTripScheduleInput,
): Promise<ActionResult<TripSchedule>> {
  return apiSend<TripSchedule>(
    `/api/fleet-owners/${ownerId}/trip-lines/${lineId}/schedules`,
    "POST",
    input,
  );
}

/** Update a recurring trip schedule. */
export function updateSchedule(
  ownerId: string,
  lineId: string,
  scheduleId: string,
  input: UpdateTripScheduleInput,
): Promise<ActionResult<TripSchedule>> {
  return apiSend<TripSchedule>(
    `/api/fleet-owners/${ownerId}/trip-lines/${lineId}/schedules/${scheduleId}`,
    "PATCH",
    input,
  );
}

/** Delete a recurring trip schedule. */
export function deleteSchedule(
  ownerId: string,
  lineId: string,
  scheduleId: string,
): Promise<ActionResult<{ id: string; occurrences: OccurrenceReport }>> {
  return apiSend<{ id: string; occurrences: OccurrenceReport }>(
    `/api/fleet-owners/${ownerId}/trip-lines/${lineId}/schedules/${scheduleId}`,
    "DELETE",
  );
}

/** Fetch occurrences (dated trips generated by this schedule). */
export function fetchScheduleTrips(
  ownerId: string,
  lineId: string,
  scheduleId: string,
  cursor: string | null = null,
): Promise<ActionResult<CursorPage<Trip>>> {
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiGet<CursorPage<Trip>>(
    `/api/fleet-owners/${ownerId}/trip-lines/${lineId}/schedules/${scheduleId}/trips${qs}`,
  );
}
