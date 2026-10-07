"use client";

import type { CommunityColumnDef } from "./ag-grid-types";
import { t } from "@/lib/i18n/t";

/**
 * Shared active/inactive pill (Principle: one style for every grid).
 * Feminine copy (نشطة/موقوفة) matches the embedded pills this replaces
 * (brands, localities, stops); masculine (نشط/موقوف) is the default.
 */
export function StatusPill({ active, feminine = false }: { active: boolean; feminine?: boolean }) {
  return (
    <span className={active ? "status-pill" : "status-pill status-pill-muted"}>
      {active
        ? feminine
          ? t("common.status.activeF")
          : t("common.status.active")
        : feminine
          ? t("common.status.inactiveF")
          : t("common.status.inactive")}
    </span>
  );
}

export function activeStatusText(active: boolean, feminine = false): string {
  return active
    ? feminine
      ? t("common.status.activeF")
      : t("common.status.active")
    : feminine
      ? t("common.status.inactiveF")
      : t("common.status.inactive");
}

type StatusColumnOptions<T> = Partial<CommunityColumnDef<T>> & {
  /** Header copy. Defaults to the shared "الحالة". */
  headerName?: string;
  /** Use نشطة/موقوفة instead of نشط/موقوف. */
  feminine?: boolean;
};

/**
 * Standalone status column for boolean `isActive` rows. Keeps a text
 * `valueFormatter` (floating filter + CSV export see Arabic, never
 * true/false) and renders the shared pill.
 */
export function activeStatusColumn<T extends { isActive: boolean }>(
  options: StatusColumnOptions<T> = {},
): CommunityColumnDef<T> {
  const { headerName, feminine = false, ...rest } = options;
  return {
    field: "isActive",
    headerName: headerName ?? t("agGrid.fields.isActive"),
    sortable: true,
    filter: "agTextColumnFilter",
    width: 130,
    valueFormatter: (params: { value: unknown }) => activeStatusText(params.value === true, feminine),
    cellRenderer: (params: { value: unknown }) =>
      params.value == null ? null : <StatusPill active={params.value === true} feminine={feminine} />,
    ...rest,
  } as CommunityColumnDef<T>;
}
