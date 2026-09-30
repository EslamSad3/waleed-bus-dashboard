"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFilterStore } from "@/stores/filters";
import { setOwnerScopeCookie } from "@/lib/owner-scope-cookie";
import { fetchSystemDriversPage, type SystemDriverRow } from "@/lib/actions/members";
import type { ActionResult } from "@/lib/actions/http";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";

/** How many roster pages the bare-bookmark fallback may walk to find a driver. */
const RESOLVE_MAX_PAGES = 10;

/**
 * Finds the company a driver belongs to from the CROSS-OWNER roster.
 *
 * The roster is a list of MEMBERSHIPS, so a driver shows up once per company;
 * the first match is the one the detail page edits. Walking a bounded number of
 * pages keeps an old bare bookmark (`/drivers/<id>` with no `?owner=`) working
 * without asking the operator to pick a company they did not come here to
 * choose.
 */
async function resolveDriverOwner(
  driverUserId: string,
  cachePage: (page: { items: SystemDriverRow[]; nextCursor: string | null }) => void,
): Promise<ActionResult<string | null>> {
  let cursor: string | null = null;
  for (let page = 0; page < RESOLVE_MAX_PAGES; page++) {
    const result = await fetchSystemDriversPage(cursor);
    if (!result.ok) return result;
    cachePage(result.data);
    const match = result.data.items.find((row) => row.userId === driverUserId);
    if (match) return { ok: true, data: match.ownerId };
    cursor = result.data.nextCursor;
    if (!cursor) break;
  }
  // The whole roster was walked without a match: the driver has no membership
  // the platform can see. An explicit null keeps the screen on the skeleton
  // instead of silently falling back to an unrelated company.
  return { ok: true, data: null };
}

/**
 * Owner scope for the driver surfaces — WITHOUT a selector.
 *
 * A driver row carries its OWN company, and the roster link writes it as
 * `?owner=<id>`, so opening a driver lands on THAT driver's company instead of
 * whatever the operator happened to leave selected elsewhere. When there is no
 * `owner` in the URL (an old bare bookmark, or a typed-in address) the company
 * is RESOLVED from the driver's own roster row rather than guessed from the
 * global filter, which is why no picker is needed on these screens at all.
 *
 * The saved global filter is the last resort, so a deep link from an
 * owner-scoped screen still lands on the company the operator was working in.
 */
export function useDriverOwnerScope(driverUserId?: string) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const storeOwnerId = useFilterStore((state) => state.ownerId);
  const setStoreOwnerId = useFilterStore((state) => state.setOwnerId);

  const explicit = searchParams.get("owner");
  const needsResolution = !explicit && !storeOwnerId;

  const cacheRosterPage = useCallback(
    (page: { items: SystemDriverRow[]; nextCursor: string | null }) => {
      // Keep the global roster cache warm so returning to /drivers shows the row
      // the operator just opened, without a second round trip.
      queryClient.setQueryData(qk.drivers, (current) => {
        const known = current as
          | { items: SystemDriverRow[]; nextCursor: string | null }
          | undefined;
        if (!known) return page;
        const fresh = new Map(page.items.map((row) => [row.id, row]));
        return {
          items: known.items.map((row) => fresh.get(row.id) ?? row),
          nextCursor: known.nextCursor ?? page.nextCursor,
        };
      });
    },
    [queryClient],
  );

  const { data: resolvedOwnerId } = useApiQuery<string | null>(
    ["driver-owner-scope", driverUserId ?? "none"],
    () => resolveDriverOwner(driverUserId as string, cacheRosterPage),
    { enabled: Boolean(driverUserId) && needsResolution },
  );

  const ownerId = explicit || (needsResolution ? resolvedOwnerId : null) || storeOwnerId || null;

  const setOwnerId = useCallback(
    (next: string | null) => {
      setStoreOwnerId(next);
      setOwnerScopeCookie(next);
      // Mirror the choice into the URL so a refresh or a shared link keeps it.
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("owner", next);
      else params.delete("owner");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, setStoreOwnerId],
  );

  return { ownerId, setOwnerId, isExplicit: Boolean(explicit) };
}

/** The `?owner=` value to put on a link to a driver surface. */
export function driverHref(driverUserId: string, ownerId: string, suffix = ""): string {
  const base = `/drivers/${driverUserId}${suffix}`;
  return ownerId ? `${base}?owner=${encodeURIComponent(ownerId)}` : base;
}
