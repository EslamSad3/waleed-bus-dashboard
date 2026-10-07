"use client";

import { useMemo, useState } from "react";
import { Eye, Plus } from "lucide-react";
import type { ICellRendererParams } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { StatusPill } from "@/components/tables/status-column";
import { RowActions } from "@/components/ui/row-actions";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeletons";
import { CreateTripLineDialog } from "@/components/trip-lines/create-trip-line-dialog";
import { fetchSystemTripLinesPage, lineEndpoints, type TripLine } from "@/lib/actions/trip-lines";
import { fetchFleetOwnersPage, fetchOwnerNameMap } from "@/lib/actions/fleet-owners";
import { qk, useApiQuery } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

/**
 * Super-admin trip-line index across every owner company. A line is ONE
 * direction, so its endpoints are the first and last ordered stop — derived
 * here with the same rule the API uses for a trip, never stored on the line.
 * Lines are created here (owner company picked inside the modal) and edited
 * on the line detail page.
 */
export default function TripLinesPage() {
  const { data: page, isLoading, error } = useApiQuery(
    qk.systemTripLines,
    () => fetchSystemTripLinesPage(null),
  );
  const { data: owners } = useApiQuery(qk.fleetOwners, () => fetchFleetOwnersPage(null));
  const [filters, setFilters] = useState<{ q?: string; ownerId?: string }>({});
  const [createOpen, setCreateOpen] = useState(false);

  const { data: ownerNameEntries } = useApiQuery(qk.ownerNames, fetchOwnerNameMap);
  const ownerNames = useMemo(() => new Map(ownerNameEntries ?? []), [ownerNameEntries]);

  const query = (filters.q ?? "").trim();
  const ownerFilter = filters.ownerId ?? "";
  const predicate = (line: TripLine) =>
    (!ownerFilter || line.ownerId === ownerFilter) &&
    (!query ||
      line.name.includes(query) ||
      line.code.includes(query) ||
      (ownerNames?.get(line.ownerId) ?? "").includes(query));

  const columns: CommunityColumnDef<TripLine>[] = [
    { field: "name", headerName: t("tripLines.columns.name"), filter: "agTextColumnFilter" },
    { field: "code", headerName: t("common.fields.code"), filter: "agTextColumnFilter" },
    {
      field: "isActive",
      headerName: t("common.fields.status"),
      filter: "agTextColumnFilter",
      cellDataType: "text",
      minWidth: 120,
      valueFormatter: (params) => (params.value ? t("common.status.active") : t("common.status.inactive")),
      cellRenderer: (params: ICellRendererParams<TripLine>) =>
        params.data ? <StatusPill active={params.data.isActive} /> : null,
    },
    {
      headerName: t("common.fields.owner"),
      valueGetter: (params) => ownerNames?.get(params.data?.ownerId ?? "") ?? params.data?.ownerId ?? "—",
      filter: "agTextColumnFilter",
    },
    {
      colId: "origin",
      headerName: t("common.fields.origin"),
      valueGetter: (params) => (params.data ? lineEndpoints(params.data).origin ?? "—" : "—"),
    },
    {
      colId: "destination",
      headerName: t("common.fields.destination"),
      valueGetter: (params) => (params.data ? lineEndpoints(params.data).destination ?? "—" : "—"),
    },
    { colId: "stops", headerName: t("tripLines.columns.stops"), valueGetter: (params) => params.data?.stops.length ?? 0, filter: "agNumberColumnFilter" },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("tripLines.title")}</h1>
          <p className="page-description">{t("tripLines.description")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> {t("tripLines.newLine")}</Button>
      </div>
      {error ? <p role="alert" className="text-sm text-red-600">{error.message}</p> : null}
      {isLoading ? (
        <TableSkeleton columns={7} />
      ) : (
        <CursorList<TripLine>
          gridId="system-trip-lines"
          initialItems={page?.items ?? []}
          initialCursor={page?.nextCursor ?? null}
          loadMore={async (cursor) => {
            const result = await fetchSystemTripLinesPage(cursor);
            if (!result.ok) throw new Error(result.message);
            return result.data;
          }}
          keyOf={(line) => line.id}
          columnDefs={columns}
          filter={predicate}
          filterBar={
            <div className="contents">
              <Input
                aria-label={t("tripLines.filters.searchAria")}
                placeholder={t("tripLines.filters.searchPlaceholder")}
                value={filters.q ?? ""}
                onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                className="w-full bg-white md:w-auto md:min-w-0 md:max-w-72 md:basis-64 md:flex-1"
              />
              <select
                aria-label={t("common.fields.owner")}
                value={ownerFilter}
                onChange={(event) => setFilters((current) => ({ ...current, ownerId: event.target.value }))}
                className="select-field w-full md:w-56"
              >
                <option value="">{t("common.value.all")}</option>
                {(owners?.items ?? []).map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name || owner.nickname || owner.phoneNumber || owner.id}
                  </option>
                ))}
              </select>
            </div>
          }
          emptyMessage={t("tripLines.empty")}
          renderItem={(line) => (
            <RowActions
              label={t("tripLines.list.rowActions", { lineName: line.name })}
              actions={[
                { label: t("common.actions.openDetails"), icon: Eye, href: `/trip-lines/${line.id}?ownerId=${line.ownerId}` },
              ]}
            />
          )}
        />
      )}

      {/* Unlocked: the owner company is picked inside the modal, so creating
          never requires leaving this page first. */}
      <CreateTripLineDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
