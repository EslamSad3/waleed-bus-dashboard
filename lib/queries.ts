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
  bus: (fleetId: string, id: string) => ["bus", fleetId, id] as const,
  fleets: ["fleets"] as const,
  fleet: (id: string) => ["fleet", id] as const,
  fleetOwners: ["fleet-owners"] as const,
  fleetOwner: (id: string) => ["fleet-owner", id] as const,
  adminUsers: ["admin-users"] as const,
  roles: ["roles"] as const,
  permissions: ["permissions"] as const,
  role: (id: string) => ["role", id] as const,
  drivers: ["drivers"] as const,
  driver: (fleetId: string, id: string) => ["driver", fleetId, id] as const,
  stops: ["stops"] as const,
  tripLines: ["trip-lines"] as const,
  tripLine: (id: string) => ["trip-line", id] as const,
  trips: (fleetId: string | null) => ["trips", fleetId] as const,
  trip: (fleetId: string | null, id: string) => ["trip", fleetId, id] as const,
  bookings: (fleetId: string | null) => ["bookings", fleetId] as const,
  booking: (fleetId: string | null, id: string) => ["booking", fleetId, id] as const,
  adminBookings: ["admin-bookings"] as const,
  adminBookingsParams: (params: unknown) => ["admin-bookings", params] as const,
  adminBooking: (id: string) => ["admin-booking", id] as const,
  notifications: ["notifications"] as const,
  promotions: ["promotions"] as const,
  serviceConfig: ["service-config"] as const,
  fleetMembers: (fleetId: string) => ["fleet-members", fleetId] as const,
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
