import { t } from "@/lib/i18n/t";

/** Arabic display names for the built-in role slugs (seed + legacy). */
const ROLE_NAMES: Record<string, string> = {
  super_admin: t("roles.names.superAdmin"),
  fleet_owner: t("roles.names.fleetOwner"),
  "fleet-manager": t("roles.names.fleetManager"),
  driver: t("roles.names.driver"),
  passenger: t("roles.names.passenger"),
  independent_driver: t("roles.names.independentDriver"),
};

type RoleLike = { slug?: string | null; name?: string | null };

/**
 * Arabic role label for grids, detail rows, pickers, and dialogs. Known
 * slugs resolve to fixed Arabic names; custom roles fall back to their
 * database name, then the raw slug, so nothing ever renders blank.
 */
export function presentRoleName(role: RoleLike | string | null | undefined): string {
  if (typeof role === "string") return ROLE_NAMES[role] ?? role;
  const slug = role?.slug ?? undefined;
  if (slug && ROLE_NAMES[slug]) return ROLE_NAMES[slug];
  return role?.name || slug || "—";
}

/** Grids that only carry the slug (members, drivers, roster rows). */
export function presentRoleSlug(slug: string | null | undefined): string {
  if (!slug) return "—";
  return ROLE_NAMES[slug] ?? slug;
}
