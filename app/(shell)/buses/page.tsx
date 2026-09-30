"use client";

import { useMemo, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { RowActions } from "@/components/ui/row-actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { deleteBus, fetchSystemBusesPage, type Bus, type BusPage } from "@/lib/actions/buses";
import { fetchOwnerNameMap } from "@/lib/actions/fleet-owners";
import { RatingCell } from "@/components/owners/rating-cell";
import { CreateBusDialog } from "@/components/buses/create-bus-dialog";
import { EditBusDialog } from "@/components/buses/edit-bus-dialog";
import { TableSkeleton } from "@/components/ui/skeletons";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { applyMutationCache, busImpact } from "@/lib/cache/mutations";
import { t } from "@/lib/i18n/t";

/** The company name comes from the shared id→name map, not from the row. */
type BusRow = Bus;

/**
 * Cross-owner bus list. The index already carries each bus's own average
 * rating, so the column needs no per-bus follow-up request, and a bus nobody
 * rated reports "not rated yet" instead of a misleading zero.
 */
export default function BusesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: first, isLoading, error } = useApiQuery<BusPage>(
    qk.systemBuses,
    () => fetchSystemBusesPage(null),
  );
  // qk.ownerNames, not qk.fleetOwners: that key holds the owners CursorPage for
  // the owners grid, and one key cannot carry two shapes.
  const { data: ownerNameEntries } = useApiQuery(qk.ownerNames, fetchOwnerNameMap);
  const ownerNames = useMemo(() => new Map(ownerNameEntries ?? []), [ownerNameEntries]);
  const [createOpen, setCreateOpen] = useState(false);
  const [busForEdit, setBusForEdit] = useState<BusRow | null>(null);
  const [listFilters, setListFilters] = useState<{ q?: string; status?: string; ownerId?: string }>({});

  const nameOf = useMemo(
    () => (ownerId: string) => ownerNames?.get(ownerId) ?? ownerId,
    [ownerNames],
  );

  async function removeBus(bus: BusRow) {
    if (
      !(await confirm({
        title: t("common.actions.deleteConfirmTitle"),
        description: t("buses.list.deleteConfirm.description", {
          value: bus.plateNumber ?? t("common.value.withoutName"),
        }),
        confirmLabel: t("common.actions.delete"),
        destructive: true,
      }))
    ) {
      return;
    }
    const result = await deleteBus(bus.ownerId, bus.id);
    if (!result.ok) return;
    applyMutationCache(
      queryClient,
      busImpact({ id: bus.id, ownerId: bus.ownerId }, "remove"),
      result,
    );
  }

  const query = (listFilters.q ?? "").trim();
  const status = listFilters.status ?? "all";
  const ownerFilter = listFilters.ownerId ?? "";
  const predicate = (bus: BusRow) =>
    (!ownerFilter || bus.ownerId === ownerFilter) &&
    (!query ||
      (bus.plateNumber ?? "").includes(query) ||
      nameOf(bus.ownerId).includes(query)) &&
    (status === "all" || (status === "active" ? bus.isActive : !bus.isActive));

  const columns: CommunityColumnDef<BusRow>[] = [
    { field: "plateNumber", headerName: t("common.fields.plateNumber"), filter: "agTextColumnFilter", valueFormatter: (params) => params.value ?? "—" },
    { field: "ownerId", headerName: t("common.fields.owner"), valueGetter: (params) => nameOf(params.data?.ownerId ?? ""), filter: "agTextColumnFilter" },
    { field: "capacity", headerName: t("common.fields.capacity"), filter: "agNumberColumnFilter" },
    { headerName: t("common.fields.avgBusRating"), cellRenderer: (params: { data: BusRow }) => <RatingCell value={params.data.avgRating ?? null} /> },
    { field: "isActive", headerName: t("common.fields.status"), filter: "agTextColumnFilter", cellDataType: "text", valueFormatter: (params) => (params.value ? t("common.status.active") : t("common.status.inactive")) },
    { field: "createdAt", headerName: t("common.fields.createdAt"), filter: "agDateColumnFilter", valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleDateString("ar-EG") : "—") },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("buses.title")}</h1>
          <p className="page-description">{t("buses.description")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>{t("buses.newBus")}</Button>
      </div>

      {error ? <p role="alert" className="text-sm text-red-600">{error.message}</p> : null}
      {isLoading ? (
        <TableSkeleton rows={9} columns={6} />
      ) : (
        <CursorList<BusRow>
          gridId="buses"
          initialItems={first?.items ?? []}
          initialCursor={first?.nextCursor ?? null}
          loadMore={async (cursor) => {
            const result = await fetchSystemBusesPage(cursor);
            if (!result.ok) throw new Error(result.message);
            return result.data;
          }}
          keyOf={(bus) => bus.id}
          filter={predicate}
          columnDefs={columns}
          filterBar={
            <div className="contents">
              <Input
                aria-label={t("buses.filters.searchAria")}
                placeholder={t("buses.filters.searchPlaceholder")}
                value={listFilters.q ?? ""}
                onChange={(event) => setListFilters((current) => ({ ...current, q: event.target.value }))}
                className="w-full bg-white md:w-auto md:min-w-0 md:max-w-72 md:basis-64 md:flex-1"
              />
              <select
                aria-label={t("common.fields.owner")}
                value={ownerFilter}
                onChange={(event) => setListFilters((current) => ({ ...current, ownerId: event.target.value }))}
                className="select-field w-full md:w-56"
              >
                <option value="">{t("common.value.all")}</option>
                {[...(ownerNames?.keys() ?? [])].map((ownerId) => (
                  <option key={ownerId} value={ownerId}>{ownerNames?.get(ownerId)}</option>
                ))}
              </select>
              <select
                aria-label={t("common.fields.status")}
                value={status}
                onChange={(event) => setListFilters((current) => ({ ...current, status: event.target.value }))}
                className="select-field w-full md:w-28"
              >
                <option value="all">{t("common.value.all")}</option>
                <option value="active">{t("common.status.active")}</option>
                <option value="inactive">{t("common.status.inactive")}</option>
              </select>
            </div>
          }
          emptyMessage={t("buses.empty")}
          renderItem={(bus) => (
            <RowActions
              label={t("buses.list.rowActions", { value: bus.plateNumber ?? t("common.value.withoutName") })}
              actions={[
                { label: t("common.actions.openDetails"), icon: Eye, href: `/buses/${bus.id}?ownerId=${bus.ownerId}` },
                { label: t("common.actions.edit"), icon: Pencil, onSelect: () => setBusForEdit(bus) },
                { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void removeBus(bus) },
              ]}
            />
          )}
        />
      )}
      <CreateBusDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditBusDialog open={Boolean(busForEdit)} bus={busForEdit} onClose={() => setBusForEdit(null)} />
    </div>
  );
}
