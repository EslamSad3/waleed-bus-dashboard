import type { MessageKey } from "@/lib/i18n/t";

/**
 * Breadcrumb route registry — one entry per authenticated dashboard page.
 *
 * 19 root/index pages: overview, fleet owners, drivers, buses, brands,
 * VIP tiers, markaz, localities, stops, trip lines, trips, bookings,
 * promotions, notifications, service configuration, users, reports, roles,
 * permissions — plus 11 nested pages: fleet-owner detail, bus detail,
 * booking detail, role detail, trip-line detail, trip detail, trip feedback,
 * driver detail, and driver assignments, ratings, and trips.
 *
 * Login stays outside the authenticated shell (no entry here); the legacy
 * `/fleets` bookmarks 308-redirect to `/fleet-owners`, so they render the
 * destination trail. `scripts/check-routes.mjs` fails when a dashboard
 * page file has no entry here.
 */

export type BreadcrumbEntry = {
  labelKey: MessageKey;
  /** Ancestor link. Omitted for the current page (rendered with aria-current). */
  href?: string;
};

function withQuery(href: string, params: URLSearchParams, keys: string[]): string {
  const kept = new URLSearchParams();
  for (const key of keys) {
    const value = params.get(key);
    if (value) kept.set(key, value);
  }
  const query = kept.toString();
  return query ? `${href}?${query}` : href;
}

/**
 * Builds the breadcrumb trail for a shell pathname. Every trail starts at
 * the overview; ancestors are links, the current page is plain text marked
 * with `aria-current="page"` by the component. Detail labels are localized
 * (never raw record ids); `owner`, `ownerId` and `lineId` ride along on the
 * ancestor links that need them so a refresh or a shared link keeps context.
 */
export function buildBreadcrumbs(
  pathname: string,
  params: URLSearchParams,
): BreadcrumbEntry[] {
  const overview: BreadcrumbEntry = { labelKey: "common.nav.overview", href: "/" };
  const current = (labelKey: MessageKey): BreadcrumbEntry[] => [
    { ...overview },
    { labelKey },
  ];

  // 19 root/index pages.
  if (pathname === "/") return [{ labelKey: "common.nav.overview" }];
  if (pathname === "/fleet-owners") return current("common.nav.fleetOwners");
  if (pathname === "/drivers") return current("common.nav.drivers");
  if (pathname === "/buses") return current("common.nav.buses");
  if (pathname === "/brands") return current("common.nav.brands");
  if (pathname === "/vip-tiers") return current("common.nav.vipTiers");
  if (pathname === "/markaz") return current("common.nav.markaz");
  if (pathname === "/localities") return current("common.nav.localities");
  if (pathname === "/stops") return current("common.nav.stops");
  if (pathname === "/trip-lines") return current("common.nav.tripLines");
  if (pathname === "/trips") return current("common.nav.trips");
  if (pathname === "/bookings") return current("common.nav.bookings");
  if (pathname === "/promotions") return current("common.nav.promotions");
  if (pathname === "/notifications") return current("common.nav.notifications");
  if (pathname === "/service-config") return current("common.nav.serviceConfig");
  if (pathname === "/users") return current("common.nav.adminUsers");
  if (pathname === "/reports") return current("common.nav.reports");
  if (pathname === "/roles") return current("common.nav.roles");
  if (pathname === "/permissions") return current("common.nav.permissions");

  // 11 nested pages. Ancestor links keep the record context they need.
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "fleet-owners" && segments.length === 2) {
    return [
      { ...overview },
      { labelKey: "common.nav.fleetOwners", href: "/fleet-owners" },
      { labelKey: "breadcrumbs.detail.fleetOwner" },
    ];
  }
  if (segments[0] === "buses" && segments.length === 2) {
    return [
      { ...overview },
      { labelKey: "common.nav.buses", href: "/buses" },
      { labelKey: "breadcrumbs.detail.bus" },
    ];
  }
  if (segments[0] === "bookings" && segments.length === 2) {
    return [
      { ...overview },
      { labelKey: "common.nav.bookings", href: "/bookings" },
      { labelKey: "breadcrumbs.detail.booking" },
    ];
  }
  if (segments[0] === "roles" && segments.length === 2) {
    return [
      { ...overview },
      { labelKey: "common.nav.roles", href: "/roles" },
      { labelKey: "breadcrumbs.detail.role" },
    ];
  }
  if (segments[0] === "trip-lines" && segments.length === 2) {
    return [
      { ...overview },
      {
        labelKey: "common.nav.tripLines",
        href: withQuery("/trip-lines", params, ["ownerId"]),
      },
      { labelKey: "breadcrumbs.detail.tripLine" },
    ];
  }
  if (segments[0] === "trips" && segments.length === 2) {
    return [
      { ...overview },
      {
        labelKey: "common.nav.trips",
        href: withQuery("/trips", params, ["ownerId", "lineId"]),
      },
      { labelKey: "breadcrumbs.detail.trip" },
    ];
  }
  if (segments[0] === "trips" && segments.length === 3 && segments[2] === "feedback") {
    const tripId = segments[1];
    return [
      { ...overview },
      {
        labelKey: "common.nav.trips",
        href: withQuery("/trips", params, ["ownerId", "lineId"]),
      },
      {
        labelKey: "breadcrumbs.detail.trip",
        href: withQuery(`/trips/${tripId}`, params, ["ownerId", "lineId"]),
      },
      { labelKey: "breadcrumbs.detail.tripFeedback" },
    ];
  }
  if (segments[0] === "drivers" && segments.length === 2) {
    return [
      { ...overview },
      { labelKey: "common.nav.drivers", href: "/drivers" },
      { labelKey: "breadcrumbs.detail.driver" },
    ];
  }
  if (segments[0] === "drivers" && segments.length === 3) {
    const driverId = segments[1];
    const sub = segments[2];
    const detailHref = withQuery(`/drivers/${driverId}`, params, ["owner"]);
    if (sub === "assignments") {
      return [
        { ...overview },
        { labelKey: "common.nav.drivers", href: "/drivers" },
        { labelKey: "breadcrumbs.detail.driver", href: detailHref },
        { labelKey: "breadcrumbs.detail.driverAssignments" },
      ];
    }
    if (sub === "ratings") {
      return [
        { ...overview },
        { labelKey: "common.nav.drivers", href: "/drivers" },
        { labelKey: "breadcrumbs.detail.driver", href: detailHref },
        { labelKey: "breadcrumbs.detail.driverRatings" },
      ];
    }
    if (sub === "trips") {
      return [
        { ...overview },
        { labelKey: "common.nav.drivers", href: "/drivers" },
        { labelKey: "breadcrumbs.detail.driver", href: detailHref },
        { labelKey: "breadcrumbs.detail.driverTrips" },
      ];
    }
  }

  // Unknown shell path (no page file): stay on the overview rather than
  // rendering a raw segment.
  return [{ labelKey: "common.nav.overview" }];
}
