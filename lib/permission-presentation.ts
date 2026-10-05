import type { Permission } from "@/lib/actions/permissions";
import { t } from "@/lib/i18n/t";

type PermissionPresentation = {
  group: string;
  title: string;
  description: string;
};

const RESOURCES: Record<string, { group: string; name: string }> = {
  users: { group: t("permissions.groups.accounts"), name: t("permissions.resources.users") },
  buses: { group: t("permissions.groups.operations"), name: t("permissions.resources.buses") },
  trips: { group: t("permissions.groups.operations"), name: t("permissions.resources.trips") },
  bookings: { group: t("permissions.groups.operations"), name: t("permissions.resources.bookings") },
  members: { group: t("permissions.groups.operations"), name: t("permissions.resources.members") },
  // Owner-company surface: one company per owner user, addressed by ownerId.
  "fleet-owners.buses": { group: t("permissions.groups.fleetOperations"), name: t("permissions.permissions.ownerBuses") },
  "fleet-owners.trips": { group: t("permissions.groups.fleetOperations"), name: t("permissions.permissions.ownerTrips") },
  "fleet-owners.lines": { group: t("permissions.groups.fleetOperations"), name: t("permissions.permissions.ownerLines") },
  "fleet-owners.drivers": { group: t("permissions.groups.fleetOperations"), name: t("permissions.permissions.ownerDrivers") },
  "fleet-owners.bookings": { group: t("permissions.groups.fleetOperations"), name: t("permissions.permissions.ownerBookings") },
  "fleet-owners.reports": { group: t("permissions.groups.fleetOperations"), name: t("permissions.permissions.ownerReports") },
  roles: { group: t("permissions.groups.systemAdmin"), name: t("permissions.resources.roles") },
  permissions: { group: t("permissions.groups.systemAdmin"), name: t("permissions.resources.permissions") },
  audit: { group: t("permissions.groups.systemAdmin"), name: t("permissions.resources.audit") },
  stations: { group: t("permissions.groups.operations"), name: t("permissions.resources.stations") },
  driver: { group: t("permissions.groups.driverOps"), name: t("permissions.resources.driver") },
  "driver.context": { group: t("permissions.groups.driverOps"), name: t("permissions.resources.driverContext") },
  "driver.passengers": { group: t("permissions.groups.driverOps"), name: t("permissions.resources.driverPassengers") },
  "driver.trips": { group: t("permissions.groups.driverOps"), name: t("permissions.resources.driverTrips") },
  // The fleet-owner account itself (platform reads/creates/updates/deletes).
  "fleet-owners": { group: t("permissions.groups.accounts"), name: t("permissions.resources.fleetOwners") },
  // Legacy company surface (spec 014 moved fleets under the owner namespace).
  "fleet-owners.fleets": { group: t("permissions.groups.fleetOperations"), name: t("permissions.resources.ownerCompanies") },
  fleets: { group: t("permissions.groups.operations"), name: t("permissions.resources.fleets") },
  routes: { group: t("permissions.groups.operations"), name: t("permissions.resources.routes") },
  // Legacy fleet.* keys from earlier migrations (kept readable on old DBs).
  "fleet.buses": { group: t("permissions.groups.fleetOperations"), name: t("permissions.permissions.ownerBuses") },
  "fleet.drivers": { group: t("permissions.groups.fleetOperations"), name: t("permissions.permissions.ownerDrivers") },
  "fleet.trips": { group: t("permissions.groups.fleetOperations"), name: t("permissions.permissions.ownerTrips") },
  "fleet.bookings": { group: t("permissions.groups.fleetOperations"), name: t("permissions.permissions.ownerBookings") },
  "fleet.reports": { group: t("permissions.groups.fleetOperations"), name: t("permissions.permissions.ownerReports") },
  "fleet.routes": { group: t("permissions.groups.fleetOperations"), name: t("permissions.permissions.ownerLines") },
};

const ACTIONS: Record<string, string> = {
  read: t("permissions.actions.read"),
  create: t("permissions.actions.create"),
  update: t("permissions.actions.update"),
  delete: t("permissions.actions.delete"),
  manage: t("permissions.actions.manage"),
  operate: t("permissions.actions.operate"),
};

/** Converts API permission identifiers into administrator-friendly Arabic. */
export function presentPermission(permission: Pick<Permission, "key" | "resource" | "action" | "description">): PermissionPresentation {
  const resource = RESOURCES[permission.resource] ?? { group: t("permissions.resources.otherGroup"), name: t("permissions.resources.other") };
  const action = ACTIONS[permission.action] ?? t("permissions.actions.other");
  return {
    group: resource.group,
    title: `${action} ${resource.name}`,
    description: permission.description || t("permissions.descriptionTemplate", { action: action, resourceName: resource.name }),
  };
}
