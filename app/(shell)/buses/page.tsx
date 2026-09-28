"use client";

import { useMemo, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { RowActions } from "@/components/ui/row-actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { deleteBus, fetchBusesPage, type Bus } from "@/lib/actions/buses";
import { fetchFleetsPage } from "@/lib/actions/fleets";
import { mapWithConcurrency } from "@/lib/actions/http";
import { CreateBusDialog } from "@/components/buses/create-bus-dialog";
import { EditBusDialog } from "@/components/buses/edit-bus-dialog";
import { TableSkeleton } from "@/components/ui/skeletons";
import { qk, removeFromCursorList, useDataQuery, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

type BusRow = Bus & { fleetName: string };
type FleetCursor = { fleetId: string; fleetName: string; cursor: string | null };
type BusAggregatePage = { items: BusRow[]; nextCursor: string | null };

async function fetchAllFleetStates(): Promise<FleetCursor[]> {
  const fleets: FleetCursor[] = [];
  let cursor: string | null = null;
  do {
    const result = await fetchFleetsPage(cursor);
    if (!result.ok) throw new Error(result.message);
    fleets.push(...result.data.items.map((fleet) => ({ fleetId: fleet.id, fleetName: fleet.name, cursor: null })));
    cursor = result.data.nextCursor;
  } while (cursor);
  return fleets;
}

async function fetchAggregateBusPage(cursorState: string | null): Promise<BusAggregatePage> {
  const states: FleetCursor[] = cursorState ? JSON.parse(cursorState) as FleetCursor[] : await fetchAllFleetStates();
  const results = await mapWithConcurrency(states, 4, async (state) => {
    const result = await fetchBusesPage(state.fleetId, state.cursor);
    if (!result.ok) throw new Error(result.message);
    return { state, page: result.data };
  });
  const nextStates = results.map(({ state, page }) => ({ ...state, cursor: page.nextCursor }));
  const items = results.flatMap(({ state, page }) => page.items.map((bus) => ({ ...bus, fleetName: state.fleetName })));
  return {
    items,
    nextCursor: nextStates.some((state) => state.cursor) ? JSON.stringify(nextStates) : null,
  };
}

export default function BusesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: first, isLoading, error } = useDataQuery<BusAggregatePage>(
    qk.busesAggregate,
    () => fetchAggregateBusPage(null),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [busForEdit, setBusForEdit] = useState<BusRow | null>(null);
  const [listFilters, setListFilters] = useState<{ q?: string; status?: string }>({});

  async function removeBus(bus: BusRow) {
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("buses.list.deleteConfirm.description", { value: bus.plateNumber || bus.registrationNumber }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteBus(bus.fleetId, bus.id);
    if (!result.ok) return;
    removeFromCursorList<BusRow>(queryClient, qk.busesAggregate, bus.id);
  }

  const query = (listFilters.q ?? "").trim();
  const status = listFilters.status ?? "all";
  const predicate = (bus: BusRow) =>
    (!query || bus.registrationNumber.includes(query) || (bus.plateNumber ?? "").includes(query) || bus.fleetName.includes(query)) &&
    (status === "all" || (status === "active" ? bus.isActive : !bus.isActive));

  const columns: CommunityColumnDef<BusRow>[] = useMemo(() => [
    { field: "registrationNumber", headerName: t("common.fields.registrationNumber"), filter: "agTextColumnFilter" },
    { field: "plateNumber", headerName: t("common.fields.plateNumber"), filter: "agTextColumnFilter" },
    { field: "fleetName", headerName: t("common.fields.fleetName"), filter: "agTextColumnFilter" },
    { field: "capacity", headerName: t("common.fields.capacity"), filter: "agNumberColumnFilter" },
    { field: "isActive", headerName: t("common.fields.status"), filter: "agTextColumnFilter", cellDataType: "text", valueFormatter: (params) => params.value ? t("common.status.active") : t("common.status.inactive") },
    { field: "createdAt", headerName: t("common.fields.createdAt"), filter: "agDateColumnFilter", valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString("ar-EG") : "—" },
  ], []);

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
      {isLoading ? <TableSkeleton rows={9} columns={7} /> : (
        <CursorList<BusRow>
          initialItems={first?.items ?? []}
          initialCursor={first?.nextCursor ?? null}
          loadMore={fetchAggregateBusPage}
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
              <select aria-label={t("common.fields.status")} value={status} onChange={(event) => setListFilters((current) => ({ ...current, status: event.target.value }))} className="select-field w-full md:w-28">
                <option value="all">{t("common.value.all")}</option>
                <option value="active">{t("common.status.active")}</option>
                <option value="inactive">{t("common.status.inactive")}</option>
              </select>
            </div>
          }
          emptyMessage={t("buses.empty")}
          renderItem={(bus) => (
            <RowActions
              label={t("buses.list.rowActions", { value: bus.plateNumber || bus.registrationNumber })}
              actions={[
                { label: t("common.actions.openDetails"), icon: Eye, href: `/buses/${bus.id}?fleetId=${bus.fleetId}` },
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
