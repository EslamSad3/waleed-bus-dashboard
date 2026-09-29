"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiGet, type ActionResult, type CursorPage } from "@/lib/actions/http";

/**
 * App-wide TanStack Query layer (issue 15): every list/detail read goes through
 * `useApiQuery`, and mutations write straight into the cache with
 * `upsertInList` / `replaceInList` / `patchDetail` so dialogs update the page
 * instantly on close (issues 3 + 5) with no refetch spinner.
 */

async function unwrap<T>(call: Promise<ActionResult<T>>): Promise<T> {
  const result = await call;
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

/** For fetchers that already return ActionResult (lib/actions/* helpers). */
export function useApiQuery<T>(
  key: readonly unknown[],
  fetcher: () => Promise<ActionResult<T>>,
  options: { enabled?: boolean } = {},
) {
  return useQuery<T, Error>({
    queryKey: key,
    queryFn: () => unwrap(fetcher()),
    enabled: options.enabled,
  });
}

/** For fetchers that return data directly and throw on failure. */
export function useDataQuery<T>(
  key: readonly unknown[],
  fetcher: () => Promise<T>,
  options: { enabled?: boolean } = {},
) {
  return useQuery<T, Error>({
    queryKey: key,
    queryFn: fetcher,
    enabled: options.enabled,
  });
}

/** Query keys — single source of truth so mutations can target the cache. */
export const qk = {
  governorates: ["governorates"] as const,
  markazAll: ["markaz", "all"] as const,
  localitiesAll: (filters: { governorateId?: string; markazId?: string }) =>
    ["localities", "all", filters] as const,
  brands: ["brands"] as const,
  vipTiers: ["vip-tiers"] as const,
  busesAggregate: ["buses", "aggregate"] as const,
  buses: (ownerId: string) => ["buses", ownerId] as const,
  bus: (ownerId: string, id: string) => ["bus", ownerId, id] as const,
  busTrips: (ownerId: string, busId: string) => ["bus-trips", ownerId, busId] as const,
  fleetOwners: ["fleet-owners"] as const,
  ownerNames: ["fleet-owners", "names"] as const,
  fleetOwner: (id: string) => ["fleet-owner", id] as const,
  myOwner: ["fleet-owners", "me"] as const,
  adminUsers: ["admin-users"] as const,
  roles: ["roles"] as const,
  permissions: ["permissions"] as const,
  role: (id: string) => ["role", id] as const,
  drivers: ["drivers"] as const,
  driver: (ownerId: string, id: string) => ["driver", ownerId, id] as const,
  driverAssignments: (ownerId: string, id: string) => ["driver-assignments", ownerId, id] as const,
  driverTripRows: (ownerId: string, id: string) => ["driver-trip-rows", ownerId, id] as const,
  driverRatings: (ownerId: string, id: string) => ["driver-ratings", ownerId, id] as const,
  stops: ["stops"] as const,
  systemTripLines: ["trip-lines", "system"] as const,
  systemTrips: ["trips", "system"] as const,
  systemBuses: ["buses", "system"] as const,
  systemDrivers: ["drivers", "system"] as const,
  tripLines: (ownerId: string) => ["trip-lines", ownerId] as const,
  tripLine: (ownerId: string, id: string) => ["trip-line", ownerId, id] as const,
  trips: (ownerId: string, lineId: string) => ["trips", ownerId, lineId] as const,
  trip: (ownerId: string, lineId: string, id: string) => ["trip", ownerId, lineId, id] as const,
  tripFeedback: (ownerId: string, lineId: string, id: string) =>
    ["trip-feedback", ownerId, lineId, id] as const,
  tripDriverFeedback: (ownerId: string, lineId: string, id: string, driverId: string) =>
    ["trip-driver-feedback", ownerId, lineId, id, driverId] as const,
  bookings: (ownerId: string | null) => ["bookings", ownerId] as const,
  booking: (ownerId: string | null, id: string) => ["booking", ownerId, id] as const,
  adminBookings: ["admin-bookings"] as const,
  adminBookingsParams: (params: unknown) => ["admin-bookings", params] as const,
  adminBooking: (id: string) => ["admin-booking", id] as const,
  notifications: ["notifications"] as const,
  promotions: ["promotions"] as const,
  serviceConfig: ["service-config"] as const,
  ownerMembers: (ownerId: string) => ["owner-members", ownerId] as const,
  ownerBuses: (ownerId: string) => ["owner-buses", ownerId] as const,
  ownerBookings: (ownerId: string) => ["owner-bookings", ownerId] as const,
  ownerReports: (ownerId: string) => ["owner-reports", ownerId] as const,
};

/** Insert-or-replace one item inside a cached plain-array list. */
export function upsertInList<T extends { id: string }>(client: QueryClient, key: readonly unknown[], item: T) {
  client.setQueryData<T[]>(key, (rows) => {
    if (!rows) return [item];
    return rows.some((row) => row.id === item.id)
      ? rows.map((row) => (row.id === item.id ? item : row))
      : [...rows, item];
  });
}

/** Remove one item from a cached plain-array list. */
export function removeFromList<T extends { id: string }>(client: QueryClient, key: readonly unknown[], id: string) {
  client.setQueryData<T[]>(key, (rows) => rows?.filter((row) => row.id !== id));
}

/** Insert-or-replace one item into the first page of a cached cursor list. */
export function upsertInCursorList<T extends { id: string }>(client: QueryClient, key: readonly unknown[], item: T) {
  client.setQueryData<CursorPage<T>>(key, (page) => {
    if (!page) return { items: [item], nextCursor: null };
    return page.items.some((row) => row.id === item.id)
      ? { ...page, items: page.items.map((row) => (row.id === item.id ? item : row)) }
      : { ...page, items: [item, ...page.items] };
  });
}

/** Replace one item in a cached cursor list without reordering. */
export function replaceInCursorList<T extends { id: string }>(client: QueryClient, key: readonly unknown[], item: T) {
  client.setQueryData<CursorPage<T>>(key, (page) =>
    page ? { ...page, items: page.items.map((row) => (row.id === item.id ? item : row)) } : page,
  );
}

/** Remove one item from the first page of a cached cursor list. */
export function removeFromCursorList<T extends { id: string }>(client: QueryClient, key: readonly unknown[], id: string) {
  client.setQueryData<CursorPage<T>>(key, (page) =>
    page ? { ...page, items: page.items.filter((row) => row.id !== id) } : page,
  );
}

/** Write a fetched/updated detail object straight into its cache slot. */
export function patchDetail<T>(client: QueryClient, key: readonly unknown[], item: T) {
  client.setQueryData<T>(key, item);
}

export { useQueryClient };
