import { can, type DashboardAccess } from "./access";

export const NAV_PERMISSIONS = {
  "/": null,
  "/fleet-owners": "fleet-owners.read",
  "/drivers": "fleet-owners.drivers.read",
  "/buses": "fleet-owners.buses.read",
  "/brands": "vehicle-brands.read",
  "/vip-tiers": "vip-tiers.read",
  "/governorates": "stations.read",
  "/markaz": "stations.read",
  "/localities": "stations.read",
  "/stops": "stations.read",
  "/trip-lines": "fleet-owners.lines.read",
  "/trips": "fleet-owners.trips.read",
  "/bookings": "bookings.read",
  "/promotions": "promotions.read",
  "/notifications": "notifications.read",
  "/service-config": "settings.read",
  "/settings": "settings.read",
  "/users": "users.read",
  "/reports": "fleet-owners.reports.read",
  "/roles": "roles.read",
  "/permissions": "permissions.read",
} as const;

export function canNavigate(identity: DashboardAccess | null, href: string): boolean {
  if (!(href in NAV_PERMISSIONS)) return false;
  const permission = NAV_PERMISSIONS[href as keyof typeof NAV_PERMISSIONS];
  return permission === null || can(identity, permission);
}
