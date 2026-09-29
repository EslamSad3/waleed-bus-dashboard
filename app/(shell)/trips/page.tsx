"use client";

import { useMemo, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { RowActions } from "@/components/ui/row-actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { OwnerPicker } from "@/components/owners/owner-picker";
import {
  deleteTrip,
  fetchTripsPage,
  TRIP_STATUS_AR,
  type Trip,
} from "@/lib/actions/trips";
import { fetchOwnerTripLinesPage, lineEndpoints } from "@/lib/actions/trip-lines";
import { fetchBusesPage } from "@/lib/actions/buses";
import { fetchDriversPage } from "@/lib/actions/members";
import { CreateTripDialog } from "@/components/trips/create-trip-dialog";
import { EditTripDialog } from "@/components/trips/edit-trip-dialog";
import { TableSkeleton } from "@/components/ui/skeletons";
import { setOwnerScopeCookie } from "@/lib/owner-scope-cookie";
import { qk, removeFromCursorList, useApiQuery, useQueryClient } from "@/lib/queries";
import { useFilterStore } from "@/stores/filters";
import { t } from "@/lib/i18n/t";

type TripRow = Trip & { busName: string; driverName: string };

/**
 * Trips live under their line and take their endpoints from it, so the screen
 * scopes by owner company, then by line. Everything shown is that line's real
 * cursor page — no cross-tenant fan-out, no derived origin/destination inputs.
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

  const { data: linesPage } = useApiQuery(
    qk.tripLines(scopedOwnerId ?? "none"),
    () => fetchOwnerTripLinesPage(scopedOwnerId!, null),
    { enabled: Boolean(scopedOwnerId) },
  );
  const { data: busesPage } = useApiQuery(
    qk.buses(scopedOwnerId ?? "none"),
    () => fetchBusesPage(scopedOwnerId!, null),
    { enabled: Boolean(scopedOwnerId) },
  );
  const { data: driversPage } = useApiQuery(
    qk.drivers,
    () => fetchDriversPage(scopedOwnerId!, null),
    { enabled: Boolean(scopedOwnerId) },
  );

  // Default to the first line of the selected company, and reset when it changes.
  const [ownerForLine, setOwnerForLine] = useState<string | null>(null);
  if (scopedOwnerId && ownerForLine !== scopedOwnerId) {
    setOwnerForLine(scopedOwnerId);
    setLineId("");
  }
  const lines = useMemo(() => linesPage?.items ?? [], [linesPage]);
  if (lines.length && !lineId && lines[0].id) setLineId(lines[0].id);

  const { data: trips, isLoading, error } = useApiQuery(
    qk.trips(scopedOwnerId ?? "none", lineId || "none"),
    () => fetchTripsPage(scopedOwnerId!, lineId, null),
    { enabled: Boolean(scopedOwnerId && lineId) },
  );

  const busNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const bus of busesPage?.items ?? []) map.set(bus.id, bus.plateNumber ?? bus.registrationNumber);
    return map;
  }, [busesPage]);

  async function removeTrip(trip: TripRow) {
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("trips.list.deleteConfirm.description", { tripOrigin: trip.origin ?? "—", tripDestination: trip.destination ?? "—" }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteTrip(scopedOwnerId!, lineId, trip.id);
    if (!result.ok) return;
    removeFromCursorList<TripRow>(queryClient, qk.trips(scopedOwnerId!, lineId), trip.id);
  }

  const query = (listFilters.q ?? "").trim();
  const status = listFilters.status ?? "all";
  const from = listFilters.from ?? "";
  const to = listFilters.to ?? "";
  const predicate = (trip: TripRow) =>
    (!query || (trip.origin ?? "").includes(query) || (trip.destination ?? "").includes(query) || trip.busName.includes(query) || trip.driverName.includes(query)) &&
    (status === "all" || trip.status === status) &&
    (!from || trip.departAt.slice(0, 10) >= from) &&
    (!to || trip.departAt.slice(0, 10) <= to);

  const columns: CommunityColumnDef<TripRow>[] = [
    { field: "line.name", headerName: t("common.fields.tripLine"), valueGetter: (params) => params.data?.line?.name },
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
        <Button onClick={() => setCreateOpen(true)} disabled={!scopedOwnerId || !lineId}>{t("trips.newTrip")}</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <OwnerPicker ownerId={scopedOwnerId ?? ""} onOwnerChange={selectOwner} />
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.tripLine")}</span>
          <select
            aria-label={t("common.fields.tripLine")}
            value={lineId}
            onChange={(event) => setLineId(event.target.value)}
            disabled={!scopedOwnerId}
            className="select-field w-full"
          >
            <option value="">{t("trips.filters.pickLine")}</option>
            {lines.map((line) => {
              const ends = lineEndpoints(line);
              return (
                <option key={line.id} value={line.id}>
                  {line.name} · {ends.origin ?? "—"} ← {ends.destination ?? "—"}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      {error ? <p role="alert" className="text-sm text-red-600">{error.message}</p> : null}
      {!scopedOwnerId ? (
        <p className="panel-card p-4 text-sm text-[#606060]">{t("trips.pickOwnerDescription")}</p>
      ) : isLoading || !lineId ? (
        <TableSkeleton columns={8} />
      ) : (
        <CursorList<TripRow>
          gridId={`trips-${lineId}`}
          initialItems={(trips?.items ?? []).map((trip) => ({
            ...trip,
            busName: busNames.get(trip.busId) ?? trip.busId.slice(0, 8),
            driverName: trip.driverUserId
              ? (driversPage?.items.find((driver) => driver.userId === trip.driverUserId)?.name ?? t("common.value.withoutName"))
              : t("common.value.unassigned"),
          }))}
          initialCursor={trips?.nextCursor ?? null}
          loadMore={async (cursor) => {
            const result = await fetchTripsPage(scopedOwnerId, lineId, cursor);
            if (!result.ok) throw new Error(result.message);
            return {
              items: result.data.items.map((trip) => ({
                ...trip,
                busName: busNames.get(trip.busId) ?? trip.busId.slice(0, 8),
                driverName: trip.driverUserId
                  ? (driversPage?.items.find((driver) => driver.userId === trip.driverUserId)?.name ?? t("common.value.withoutName"))
                  : t("common.value.unassigned"),
              })),
              nextCursor: result.data.nextCursor,
            };
          }}
          keyOf={(trip) => trip.id}
          filter={predicate}
          columnDefs={columns}
          filterBar={
            <div className="contents">
              <Input aria-label={t("trips.filters.searchAria")} placeholder={t("trips.filters.searchPlaceholder")} value={listFilters.q ?? ""} onChange={(event) => setListFilters((current) => ({ ...current, q: event.target.value }))} className="w-full bg-white md:min-w-0 md:w-auto md:max-w-52 md:flex-1" />
              <select aria-label={t("common.fields.status")} value={status} onChange={(event) => setListFilters((current) => ({ ...current, status: event.target.value }))} className="select-field w-full md:w-auto"><option value="all">{t("trips.filters.allStatuses")}</option><option value="SCHEDULED">{t("enums.tripStatus.scheduled")}</option><option value="DEPARTED">{t("enums.tripStatus.running")}</option><option value="COMPLETED">{t("enums.tripStatus.completed")}</option><option value="CANCELLED">{t("enums.tripStatus.cancelled")}</option></select>
              <Input aria-label={t("bookings.filters.fromDate")} type="date" value={from} onChange={(event) => setListFilters((current) => ({ ...current, from: event.target.value }))} className="w-full bg-white md:w-auto md:max-w-44" />
              <Input aria-label={t("bookings.filters.toDate")} type="date" value={to} onChange={(event) => setListFilters((current) => ({ ...current, to: event.target.value }))} className="w-full bg-white md:w-auto md:max-w-44" />
            </div>
          }
          emptyMessage={t("trips.empty")}
          renderItem={(trip) => (
            <RowActions
              label={t("trips.list.rowActions", { tripOrigin: trip.origin ?? "—", tripDestination: trip.destination ?? "—" })}
              actions={[
                { label: t("common.actions.openDetails"), icon: Eye, href: `/trips/${trip.id}?ownerId=${scopedOwnerId}&lineId=${lineId}` },
                { label: t("common.actions.edit"), icon: Pencil, onSelect: () => setTripForEdit(trip) },
                { label: t("common.actions.viewFeedback"), icon: Eye, href: `/trips/${trip.id}/feedback?ownerId=${scopedOwnerId}` },
                { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void removeTrip(trip) },
              ]}
            />
          )}
        />
      )}
      <CreateTripDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditTripDialog open={Boolean(tripForEdit)} trip={tripForEdit} lineId={lineId} onClose={() => setTripForEdit(null)} />
    </div>
  );
}
