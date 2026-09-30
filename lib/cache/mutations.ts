"use client";

import type { QueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queries";
import type { ActionResult } from "@/lib/actions/http";
import type { SystemDriverRow } from "@/lib/actions/members";
import type { Booking } from "@/lib/actions/bookings";
import type { Bus } from "@/lib/actions/buses";
import type { FleetOwnerAccount } from "@/lib/actions/fleet-owners";
import type { Member } from "@/lib/actions/members";
import type { Promotion } from "@/lib/actions/promotions";
import type { Role } from "@/lib/actions/roles";
import type { ServiceConfigEntry } from "@/lib/actions/service-config";
import type { TripLine } from "@/lib/actions/trip-lines";
import type { Trip } from "@/lib/actions/trips";
import type { AdminUser } from "@/lib/actions/users";
import type { OpsNotification } from "@/lib/actions/notifications";
import type { Permission } from "@/lib/actions/permissions";

/**
 * Applies an immediate patch to known list and detail keys after a mutation.
 *
 * Why centralised: freshness after THIS operator's own edit is the contract.
 * `router.refresh()` re-renders the server tree but never touches TanStack's
 * client cache, so a dialog that only refreshed left the previous list showing
 * stale rows until something else happened to invalidate them. Every action now
 * declares what it touched and this module reconciles the matching keys.
 *
 * Two rules make it safe to call from anywhere:
 * 1. NEVER call it on a failure. A partial cache write on a rejected mutation
 *    would show a row the server never accepted.
 * 2. Merge returned fields only into an existing record with the same id.
 *    Inserts and unknown shapes are refetched instead of inventing a row.
 */

const isPage = <T,>(rows: unknown): rows is { items: T[]; nextCursor: string | null } =>
  typeof rows === "object" && rows !== null &&
  "items" in rows && Array.isArray(rows.items);

// ---------------------------------------------------------------------------
// Resource → key mapping
// ---------------------------------------------------------------------------

/**
 * Every resource a mutation can touch, and the cache slots it implies.
 *
 * `prefixes` are the families whose FILTERED variants must also be reconciled:
 * a list that can be filtered/owned by another scope cannot be repaired by
 * patching the one key the screen happens to be showing, so the whole family is
 * invalidated by prefix and refetched.
 */
export type MutationImpact = {
  /** Exact keys to patch with the returned row. */
  keys: readonly (readonly unknown[])[];
  /** Key families to invalidate by prefix (filtered / dependent views). */
  prefixes: readonly (readonly unknown[])[];
  /** Ids to remove from every key above. */
  removeIds?: readonly string[];
  /** A status-only change to apply instead of removing (a revoke must stay). */
  revoked?: { id: string; status: string };
  /** The affected record's id, used to match existing cached rows. */
  row?: { id: string };
  mode?: "insert" | "update" | "remove";
};

/** Trips: the global index, the owner/line list, the detail, and the dependents. */
export function tripImpact(input: {
  trip: Pick<Trip, "id" | "ownerId" | "lineId">;
  mode: "insert" | "update" | "remove";
}): MutationImpact {
  const { trip, mode } = input;
  const keys: (readonly unknown[])[] = [
    qk.tripsIndex("all"),
    qk.tripsIndex(`owner:${trip.ownerId}`),
    qk.tripsIndex(`line:${trip.lineId}`),
    qk.trip(trip.ownerId, trip.lineId, trip.id),
  ];
  return {
    keys,
    // A trip change is visible through its line, its owner, the flat index, the
    // detail page, and the booking/feedback screens that read the same record.
    prefixes: [["trips"], ["trips-index"], ["trip"], ["trip-line-choices"], ["trip-feedback"], ["trip-driver-feedback"]],
    mode,
    ...(mode === "remove" ? { removeIds: [trip.id] } : { row: { id: trip.id } }),
  };
}

/** Drivers: the global roster, the owner roster, the detail, the histories. */
export function driverImpact(input: {
  driver: Pick<SystemDriverRow, "id" | "ownerId" | "userId">;
  mode: "insert" | "update" | "remove";
  /** An independent driver is REVOKED, so its row must stay visible. */
  revoked?: boolean;
}): MutationImpact {
  const { driver, mode } = input;
  const keys: (readonly unknown[])[] = [
    qk.drivers,
    qk.ownerDrivers(driver.ownerId),
    qk.driver(driver.ownerId, driver.userId ?? driver.id),
  ];
  return {
    keys,
    // Bus-assignment displays and every driver history page read the same rows.
    prefixes: [["drivers"], ["owner-drivers"], ["driver"], ["driver-assignments"], ["driver-trip-rows"], ["driver-ratings"], ["bus"]],
    mode,
    ...(mode === "remove"
      ? input.revoked
        ? { revoked: { id: driver.id, status: "REVOKED" } }
        : { removeIds: [driver.id] }
      : { row: { id: driver.id } }),
  };
}

function plainImpact<T extends { id: string }>(
  keys: readonly (readonly unknown[])[],
  prefixes: readonly (readonly unknown[])[],
  mode: "insert" | "update" | "remove",
  id: string,
): MutationImpact {
  return {
    keys,
    prefixes,
    mode,
    ...(mode === "remove" ? { removeIds: [id] } : { row: { id } }),
  };
}

export const busImpact = (bus: Pick<Bus, "id" | "ownerId">, mode: "insert" | "update" | "remove") =>
  plainImpact([qk.buses(bus.ownerId), qk.bus(bus.ownerId, bus.id), qk.systemBuses], [["buses"], ["bus"], ["bus-trips"]], mode, bus.id);

export const ownerImpact = (owner: Pick<FleetOwnerAccount, "id">, mode: "insert" | "update" | "remove") =>
  plainImpact([qk.fleetOwners, qk.fleetOwner(owner.id), qk.myOwner], [["fleet-owners"], ["fleet-owner"]], mode, owner.id);

export const memberImpact = (ownerId: string, member: Pick<Member, "id">, mode: "insert" | "update" | "remove") =>
  plainImpact([qk.ownerMembers(ownerId)], [["owner-members"]], mode, member.id);

export const tripLineImpact = (ownerId: string, line: Pick<TripLine, "id">, mode: "insert" | "update" | "remove") =>
  plainImpact([qk.tripLines(ownerId), qk.tripLine(ownerId, line.id), qk.tripLineChoices(ownerId)], [["trip-lines"], ["trip-line"]], mode, line.id);

export const bookingImpact = (ownerId: string | null, booking: Pick<Booking, "id">, mode: "insert" | "update" | "remove") =>
  plainImpact([qk.bookings(ownerId), qk.booking(ownerId, booking.id), qk.adminBookings, qk.adminBooking(booking.id)], [["bookings"], ["booking"], ["admin-bookings"], ["admin-booking"]], mode, booking.id);

export const userImpact = (user: Pick<AdminUser, "id">, mode: "insert" | "update" | "remove") =>
  plainImpact([qk.adminUsers], [["admin-users"], ["users"]], mode, user.id);

export const roleImpact = (role: Pick<Role, "id">, mode: "insert" | "update" | "remove") =>
  plainImpact([qk.roles, qk.role(role.id)], [["roles"], ["role"]], mode, role.id);

export const permissionImpact = (permission: Pick<Permission, "id">, mode: "insert" | "update" | "remove") =>
  plainImpact([qk.permissions], [["permissions"]], mode, permission.id);

export const promotionImpact = (promotion: Pick<Promotion, "id">, mode: "insert" | "update" | "remove") =>
  plainImpact([qk.promotions], [["promotions"]], mode, promotion.id);

export const notificationImpact = (notification: Pick<OpsNotification, "id">, mode: "insert" | "update" | "remove") =>
  plainImpact([qk.notifications], [["notifications"]], mode, notification.id);

export const serviceConfigImpact = (entry: Pick<ServiceConfigEntry, "id">) =>
  plainImpact([qk.serviceConfig], [["service-config"]], "update", entry.id);

/** Reference data (stops, localities, markaz, governorates, brands, tiers). */
export const referenceImpact = (id: string, family: string, mode: "insert" | "update" | "remove") =>
  plainImpact([], [[family], ["markaz"], ["localities"], ["governorates"], ["brands"], ["vip-tiers"], ["stops"]], mode, id);

/** Invalidate a whole family when a returned row is too partial to draw. */
export const evictImpact = (...prefixes: (readonly unknown[])[]): MutationImpact => ({
  keys: [],
  prefixes,
});

// ---------------------------------------------------------------------------
// The single entry point
// ---------------------------------------------------------------------------

/**
 * Reconciles the cache for ONE successful mutation.
 *
 * Call it only from the success branch of an action. A failed mutation returns
 * early at every call site, which is the whole point: nothing here may ever run
 * against a rejection.
 *
 * A returned record can update matching cached rows. Lists are invalidated so
 * inserts, filters, order, and derived fields always settle to server truth.
 */
export function applyMutationCache<T, R extends { id: string } = { id: string }>(
  client: QueryClient,
  impact: MutationImpact,
  result: ActionResult<T>,
  options: { row?: R; idOf?: (row: T) => string } = {},
): void {
  if (!result.ok) return;

  const { keys, prefixes, removeIds, revoked, row, mode } = impact;
  const returned = options.row ?? result.data;
  const returnedObject = returned !== null && typeof returned === "object" && !Array.isArray(returned)
    ? returned as Record<string, unknown>
    : null;
  const id = row ? (options.idOf?.(result.data) ?? row.id) : undefined;
  const update = mode === "update" && returnedObject && id && returnedObject.id === id;

  const patch = (cached: unknown): unknown => {
    if (cached === undefined) return cached;
    if (Array.isArray(cached)) {
      if (removeIds) return cached.filter((entry) => !removeIds.includes(entry?.id));
      if (revoked) {
        const { id: revokedId, status } = revoked;
        return cached.map((entry) => entry?.id === revokedId ? { ...entry, status } : entry);
      }
      if (update) return cached.map((entry) => entry?.id === id ? { ...entry, ...returnedObject } : entry);
      return cached;
    }
    if (isPage<Record<string, unknown>>(cached)) {
      return { ...cached, items: patch(cached.items) };
    }
    if (typeof cached === "object" && cached !== null && "id" in cached) {
      if (removeIds?.includes(cached.id as string)) return undefined;
      if (revoked && revoked.id === cached.id) return { ...cached, status: revoked.status };
      if (update && cached.id === id) return { ...cached, ...returnedObject };
    }
    return cached;
  };

  for (const key of keys) {
    if (client.getQueryState(key) !== undefined) client.setQueryData(key, patch);
  }

  // Filtered variants and dependent summaries cannot be patched reliably, so
  // mark them stale and refetch active queries in the background.
  for (const prefix of prefixes) {
    void client.invalidateQueries({ queryKey: prefix });
  }
  for (const key of keys) void client.invalidateQueries({ queryKey: key, exact: true });
}

/** Drops every cached record. Called on logout so nothing survives the session. */
export function clearUserCache(client: QueryClient): void {
  client.clear();
}
