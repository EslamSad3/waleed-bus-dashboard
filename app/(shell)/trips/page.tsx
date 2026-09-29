"use client";

import { useMemo, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { RowActions } from "@/components/ui/row-actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { deleteTrip, fetchSystemTripsPage, fetchTripsPage, TRIP_STATUS_AR, type Trip, type TripPage } from "@/lib/actions/trips";
import { fetchOwnerTripLinesPage, fetchSystemTripLinesPage, lineEndpoints } from "@/lib/actions/trip-lines";
import { fetchFleetOwnersPage } from "@/lib/actions/fleet-owners";
import { fetchDriversPage } from "@/lib/actions/members";
import { CreateTripDialog } from "@/components/trips/create-trip-dialog";
import { EditTripDialog } from "@/components/trips/edit-trip-dialog";
import { setOwnerScopeCookie } from "@/lib/owner-scope-cookie";
import { qk, removeFromCursorList, useApiQuery, useQueryClient } from "@/lib/queries";
import { useFilterStore } from "@/stores/filters";
import { t } from "@/lib/i18n/t";

/** A trip plus the two labels the grid shows, resolved from the row itself. */
type TripRow = Trip & { busName: string; driverName: string };

/**
 * One stable fetch: every trip, cursor-paged. The company and line pickers are
 * RECORD filters (like status, dates and search) — they narrow the rows already
 * loaded instead of changing the query, so picking one never rebuilds the grid
 * or drops the rows the user has already loaded.
 */
export default function TripsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const scopedOwnerId = useFilterStore((s) => s.ownerId);
  const setOwnerId = useFilterStore((s) => s.setOwnerId);
  const [lineId, setLineId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [tripForEdit, setTripForEdit] = useState<TripRow | null>(null);
  const [listFilters, setListFilters] = useState<{ q?: string; status?: string; from?: string; to?: string }>({});
  const range = { from: listFilters.from ?? "", to: listFilters.to ?? "" };

  // The line picker narrows the records, so it needs the line list, not the
  // line's trips: all lines when nothing is chosen, that company's lines once it is.
  const { data: linesPage } = useApiQuery(
    qk.tripLineChoices(scopedOwnerId ?? "all"),
    () => (scopedOwnerId ? fetchOwnerTripLinesPage(scopedOwnerId, null) : fetchSystemTripLinesPage(null)),
  );
  const { data: owners } = useApiQuery(qk.fleetOwners, () => fetchFleetOwnersPage(null));
  const { data: driversPage } = useApiQuery(
    qk.drivers,
    () => fetchDriversPage(scopedOwnerId!, null),
    { enabled: Boolean(scopedOwnerId) },
  );

  const lines = useMemo(() => linesPage?.items ?? [], [linesPage]);
  const ownerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const owner of owners?.items ?? []) map.set(owner.id, owner.name || owner.nickname || owner.phoneNumber || owner.id);
    return map;
  }, [owners]);

  const { data: trips, isLoading, error } = useApiQuery<TripPage>(qk.tripsIndex("all"), () => fetchSystemTripsPage(null));

  const withLabels = (trip: Trip): TripRow => ({
    ...trip,
    busName: trip.bus?.plateNumber || trip.bus?.registrationNumber || trip.busId.slice(0, 8),
    driverName: trip.driverUserId
      ? (driversPage?.items.find((driver) => driver.userId === trip.driverUserId)?.name ?? t("common.value.withoutName"))
      : (trip.driver?.name ?? t("common.value.unassigned")),
  });

  async function removeTrip(trip: TripRow) {
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("trips.list.deleteConfirm.description", { tripOrigin: trip.origin ?? "—", tripDestination: trip.destination ?? "—" }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteTrip(trip.ownerId, trip.lineId, trip.id);
    if (!result.ok) return;
    removeFromCursorList<TripRow>(queryClient, qk.tripsIndex("all"), trip.id);
  }

  const query = (listFilters.q ?? "").trim();
  const status = listFilters.status ?? "all";
  const from = listFilters.from ?? "";
  const to = listFilters.to ?? "";
  const predicate = (trip: TripRow) =>
    (!scopedOwnerId || trip.ownerId === scopedOwnerId) &&
    (!lineId || trip.lineId === lineId) &&
    (!query ||
      (trip.origin ?? "").includes(query) ||
      (trip.destination ?? "").includes(query) ||
      trip.busName.includes(query) ||
      trip.driverName.includes(query) ||
      (trip.line?.name ?? "").includes(query)) &&
    (status === "all" || trip.status === status) &&
    (!from || trip.departAt.slice(0, 10) >= from) &&
    (!to || trip.departAt.slice(0, 10) <= to);

  const columns: CommunityColumnDef<TripRow>[] = [
    { field: "line.name", headerName: t("common.fields.tripLine"), valueGetter: (params) => params.data?.line?.name || "—" },
    { field: "origin", headerName: t("common.fields.origin"), valueGetter: (params) => params.data?.origin || "—" },
    { field: "destination", headerName: t("common.fields.destination"), valueGetter: (params) => params.data?.destination || "—" },
    { field: "busName", headerName: t("common.fields.bus"), filter: "agTextColumnFilter" },
    { field: "driverName", headerName: t("common.fields.snapshottedDriver"), filter: "agTextColumnFilter" },
    { field: "departAt", headerName: t("trips.columns.departAt"), filter: "agDateColumnFilter", valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleString("ar-EG") : "—") },
    { field: "status", headerName: t("common.fields.status"), filter: "agTextColumnFilter", valueFormatter: (params) => TRIP_STATUS_AR[params.value as Trip["status"]] ?? params.value },
    { field: "fare", headerName: t("common.fields.fare") },
  ];

  function selectOwner(nextOwnerId: string) {
    setOwnerId(nextOwnerId || null);
    setOwnerScopeCookie(nextOwnerId || null);
    setLineId("");
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("trips.title")}</h1>
          <p className="page-description">{t("trips.description")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!scopedOwnerId} title={!scopedOwnerId ? t("trips.pickOwnerDescription") : undefined}>
          {t("trips.newTrip")}
        </Button>
      </div>

      {error ? <p role="alert" className="text-sm text-red-600">{error.message}</p> : null}

      {isLoading ? (
        <div className="panel-card p-4"><div className="h-40 animate-pulse rounded-xl bg-[#f1f6fa]" /></div>
      ) : (
        <CursorList<TripRow>
          gridId="trips-all"
          initialItems={(trips?.items ?? []).map(withLabels)}
          initialCursor={trips?.nextCursor ?? null}
          loadMore={async (cursor) => {
            const result = await fetchSystemTripsPage(cursor);
            if (!result.ok) throw new Error(result.message);
            return {
              items: result.data.items.map(withLabels),
              nextCursor: result.data.nextCursor,
            };
          }}
          keyOf={(trip) => trip.id}
          filter={predicate}
          columnDefs={columns}
          filterBar={
            <div className="contents">
              <select
                aria-label={t("common.fields.owner")}
                value={scopedOwnerId ?? ""}
                onChange={(event) => selectOwner(event.target.value)}
                className="select-field w-full bg-white md:w-auto md:max-w-52"
              >
                <option value="">{t("bookings.filters.allOwners")}</option>
                {(owners?.items ?? []).map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name || owner.nickname || owner.phoneNumber || owner.id}
                  </option>
                ))}
              </select>
              <select
                aria-label={t("common.fields.tripLine")}
                value={lineId}
                onChange={(event) => setLineId(event.target.value)}
                disabled={!scopedOwnerId}
                className="select-field w-full bg-white md:w-auto md:max-w-64"
              >
                <option value="">{t("trips.filters.allLines")}</option>
                {lines.map((line) => {
                  const ends = lineEndpoints(line);
                  const ownerName = ownerNameById.get(line.ownerId);
                  return (
                    <option key={line.id} value={line.id}>
                      {ownerName ? `${ownerName} · ` : ""}
                      {line.name} · {ends.origin ?? "—"} ← {ends.destination ?? "—"}
                    </option>
                  );
                })}
              </select>
              <Input aria-label={t("trips.filters.searchAria")} placeholder={t("trips.filters.searchPlaceholder")} value={listFilters.q ?? ""} onChange={(event) => setListFilters((current) => ({ ...current, q: event.target.value }))} className="w-full bg-white md:min-w-0 md:w-auto md:max-w-52 md:flex-1" />
              <select aria-label={t("common.fields.status")} value={status} onChange={(event) => setListFilters((current) => ({ ...current, status: event.target.value }))} className="select-field w-full md:w-auto"><option value="all">{t("trips.filters.allStatuses")}</option><option value="SCHEDULED">{t("enums.tripStatus.scheduled")}</option><option value="DEPARTED">{t("enums.tripStatus.running")}</option><option value="COMPLETED">{t("enums.tripStatus.completed")}</option><option value="CANCELLED">{t("enums.tripStatus.cancelled")}</option></select>
              <DateRangePicker
                ariaLabel={t("dateRange.aria")}
                value={range}
                onChange={(next) => setListFilters((current) => ({ ...current, from: next.from, to: next.to }))}
                presets={[
                  { days: 7, label: t("dateRange.last7") },
                  { days: 30, label: t("dateRange.last30") },
                ]}
              />
            </div>
          }
          emptyMessage={t("trips.empty")}
          renderItem={(trip) => (
            <RowActions
              label={t("trips.list.rowActions", { tripOrigin: trip.origin ?? "—", tripDestination: trip.destination ?? "—" })}
              actions={[
                { label: t("common.actions.openDetails"), icon: Eye, href: `/trips/${trip.id}?ownerId=${trip.ownerId}&lineId=${trip.lineId}` },
                { label: t("common.actions.edit"), icon: Pencil, onSelect: () => setTripForEdit(trip) },
                { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void removeTrip(trip) },
              ]}
            />
          )}
        />
      )}

      <CreateTripDialog open={createOpen} lockedOwnerId={scopedOwnerId ?? undefined} lockedLineId={lineId || undefined} onClose={() => setCreateOpen(false)} />
      <EditTripDialog open={Boolean(tripForEdit)} trip={tripForEdit} lineId={tripForEdit?.lineId ?? lineId} onClose={() => setTripForEdit(null)} />
    </div>
  );
}
