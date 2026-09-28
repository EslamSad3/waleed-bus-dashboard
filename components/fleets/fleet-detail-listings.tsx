"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeletons";
import { CreateBusDialog } from "@/components/buses/create-bus-dialog";
import { EditBusDialog } from "@/components/buses/edit-bus-dialog";
import { CreateTripDialog } from "@/components/trips/create-trip-dialog";
import { EditTripDialog } from "@/components/trips/edit-trip-dialog";
import { CreateBookingDialog } from "@/components/bookings/create-booking-dialog";
import { deleteBus, disableBus, fetchBusesPage, reactivateBus, type Bus } from "@/lib/actions/buses";
import { deleteTrip, fetchTripsPage, TRIP_STATUS_AR, type Trip } from "@/lib/actions/trips";
import { deleteBooking, fetchBookingsPage, BOOKING_STATUS_AR, PAYMENT_STATUS_AR, type Booking } from "@/lib/actions/bookings";
import { fetchFleetReports, type FleetReports } from "@/lib/actions/reports";
import { qk, removeFromCursorList, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";
import type { ActionResult, CursorPage } from "@/lib/actions/http";
import { t } from "@/lib/i18n/t";

type ListingState<T> = { items: T[]; nextCursor: string | null };
type FetchPage<T> = (fleetId: string, cursor: string | null) => Promise<ActionResult<CursorPage<T>>>;
type FleetReport = FleetReports["reports"][number];

function ListingShell({
  children,
  error,
  isLoading,
  skeleton,
}: {
  children: ReactNode;
  error: string | null;
  isLoading: boolean;
  /** Skeleton mirroring the loaded layout — replaces the old text spinner. */
  skeleton: ReactNode;
}) {
  if (error) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (isLoading) return <>{skeleton}</>;
  return <>{children}</>;
}

function TabHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="section-title mb-0 min-w-0">{title}</h2>
      {actionLabel && onAction ? (
        <Button type="button" size="sm" className="max-md:w-full" onClick={onAction}>{actionLabel}</Button>
      ) : null}
    </div>
  );
}

/**
 * Skeleton for the reports tab: the three rating-summary stat boxes plus the
 * reports table, in the loaded layout. The TableSkeleton carries the single
 * role="status" announcement; the decorative stat bars are aria-hidden.
 */
function ReportsTabSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((box) => (
          <div key={box} className="rounded-xl bg-[#eaf6ff] p-4">
            <Skeleton className="h-5 w-28 max-w-full" />
            <Skeleton className="mt-1 h-7 w-12" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={6} columns={2} />
    </div>
  );
}

export function FleetBusesTab({ fleetId }: { fleetId: string }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const [busForEdit, setBusForEdit] = useState<Bus | null>(null);
  const { data: page, isLoading, error } = useApiQuery(qk.fleetBuses(fleetId), () => fetchBusesPage(fleetId, null));

  async function toggleActive(bus: Bus) {
    const result = bus.isActive ? await disableBus(fleetId, bus.id) : await reactivateBus(fleetId, bus.id);
    if (!result.ok) return;
    upsertInCursorList(queryClient, qk.fleetBuses(fleetId), result.data);
  }

  async function removeBus(bus: Bus) {
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("buses.list.deleteConfirm.description", { value: bus.plateNumber || bus.registrationNumber }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteBus(fleetId, bus.id);
    if (!result.ok) return;
    removeFromCursorList<Bus>(queryClient, qk.fleetBuses(fleetId), bus.id);
  }

  const columns: CommunityColumnDef<Bus>[] = [
    { field: "registrationNumber", headerName: t("common.fields.registrationNumber"), filter: "agTextColumnFilter" },
    { field: "plateNumber", headerName: t("common.fields.plateNumber"), filter: "agTextColumnFilter", valueFormatter: (params) => params.value || "—" },
    { field: "capacity", headerName: t("common.fields.capacity"), filter: "agNumberColumnFilter" },
    { field: "isActive", headerName: t("common.fields.status"), filter: "agTextColumnFilter", cellDataType: "text", valueFormatter: (params) => (params.value ? t("common.status.active") : t("common.status.inactive")) },
    { field: "createdAt", headerName: t("common.fields.createdAt"), filter: "agDateColumnFilter", valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleDateString("ar-EG") : "—") },
  ];

  return (
    <section className="panel-card p-5 sm:p-6">
      <TabHeader title={t("fleetOwners.fleets.detail.tabs.busesTitle")} actionLabel={t("common.actions.addBus")} onAction={() => setCreateOpen(true)} />
      <ListingShell error={error?.message ?? null} isLoading={isLoading} skeleton={<TableSkeleton rows={8} columns={6} />}>
        <CursorList<Bus>
          gridId={`fleet-buses-${fleetId}`}
          initialItems={page?.items ?? []}
          initialCursor={page?.nextCursor ?? null}
          loadMore={async (cursor) => {
            const result = await fetchBusesPage(fleetId, cursor);
            if (!result.ok) throw new Error(result.message);
            return result.data;
          }}
          keyOf={(bus) => bus.id}
          columnDefs={columns}
          emptyMessage={t("fleetOwners.fleets.detail.tabs.busesEmpty")}
          renderItem={(bus) => (
            <RowActionsMenu
              label={t("fleetOwners.fleets.detail.tabs.busRowActions", { busRegistrationNumber: bus.registrationNumber })}
              actions={[
                { label: t("common.actions.openDetails"), href: `/buses/${bus.id}?fleetId=${fleetId}` },
                { label: t("common.actions.edit"), onSelect: () => setBusForEdit(bus) },
                { label: bus.isActive ? t("common.actions.disable") : t("buses.detail.actions.reactivate"), onSelect: () => void toggleActive(bus) },
                { label: t("common.actions.delete"), danger: true, onSelect: () => void removeBus(bus) },
              ]}
            />
          )}
        />
      </ListingShell>
      <CreateBusDialog
        open={createOpen}
        lockedFleetId={fleetId}
        onCreated={(bus) => upsertInCursorList(queryClient, qk.fleetBuses(fleetId), bus)}
        onClose={() => setCreateOpen(false)}
      />
      <EditBusDialog open={Boolean(busForEdit)} bus={busForEdit} onClose={() => setBusForEdit(null)} />
    </section>
  );
}

export function FleetTripsTab({ fleetId }: { fleetId: string }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const [tripForEdit, setTripForEdit] = useState<Trip | null>(null);
  const { data: page, isLoading, error } = useApiQuery(qk.fleetTrips(fleetId), () => fetchTripsPage(fleetId, null));

  async function removeTrip(trip: Trip) {
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("fleetOwners.fleets.detail.tabs.tripDeleteConfirm", { tripOrigin: trip.origin, tripDestination: trip.destination }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteTrip(fleetId, trip.id);
    if (!result.ok) return;
    removeFromCursorList<Trip>(queryClient, qk.fleetTrips(fleetId), trip.id);
  }

  const columns: CommunityColumnDef<Trip>[] = [
    { field: "origin", headerName: t("common.fields.origin"), filter: "agTextColumnFilter" },
    { field: "destination", headerName: t("common.fields.destination"), filter: "agTextColumnFilter" },
    { field: "departAt", headerName: t("fleetOwners.fleets.detail.tabs.tripsSchedule"), filter: "agDateColumnFilter", valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleString("ar-EG") : "—") },
    { field: "status", headerName: t("common.fields.status"), filter: "agTextColumnFilter", cellDataType: "text", valueFormatter: (params) => TRIP_STATUS_AR[params.value as Trip["status"]] ?? params.value },
  ];

  return (
    <section className="panel-card p-5 sm:p-6">
      <TabHeader title={t("fleetOwners.fleets.detail.tabs.tripsTitle")} actionLabel={t("fleetOwners.fleets.detail.tabs.addTrip")} onAction={() => setCreateOpen(true)} />
      <ListingShell error={error?.message ?? null} isLoading={isLoading} skeleton={<TableSkeleton rows={8} columns={5} />}>
        <CursorList<Trip>
          gridId={`fleet-trips-${fleetId}`}
          initialItems={page?.items ?? []}
          initialCursor={page?.nextCursor ?? null}
          loadMore={async (cursor) => {
            const result = await fetchTripsPage(fleetId, cursor);
            if (!result.ok) throw new Error(result.message);
            return result.data;
          }}
          keyOf={(trip) => trip.id}
          columnDefs={columns}
          emptyMessage={t("fleetOwners.fleets.detail.tabs.tripsEmpty")}
          renderItem={(trip) => (
            <RowActionsMenu
              label={t("fleetOwners.fleets.detail.tabs.tripRowActions")}
              actions={[
                { label: t("common.actions.openDetails"), href: `/trips/${trip.id}` },
                { label: t("common.actions.edit"), onSelect: () => setTripForEdit(trip) },
                { label: t("common.actions.delete"), danger: true, onSelect: () => void removeTrip(trip) },
              ]}
            />
          )}
        />
      </ListingShell>
      <CreateTripDialog
        open={createOpen}
        onCreated={(trip) => upsertInCursorList(queryClient, qk.fleetTrips(fleetId), trip)}
        onClose={() => setCreateOpen(false)}
      />
      <EditTripDialog open={Boolean(tripForEdit)} trip={tripForEdit} onClose={() => setTripForEdit(null)} />
    </section>
  );
}

export function FleetBookingsTab({ fleetId }: { fleetId: string }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: page, isLoading, error } = useApiQuery(qk.fleetBookings(fleetId), () => fetchBookingsPage(fleetId, null));

  async function removeBooking(booking: Booking) {
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("fleetOwners.fleets.detail.tabs.bookingDeleteConfirm", { bookingPassengerName: booking.passengerName }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteBooking(fleetId, booking.id);
    if (!result.ok) return;
    removeFromCursorList<Booking>(queryClient, qk.fleetBookings(fleetId), booking.id);
  }

  const columns: CommunityColumnDef<Booking>[] = [
    { field: "passengerName", headerName: t("common.fields.passenger"), filter: "agTextColumnFilter" },
    { field: "seats", headerName: t("common.fields.seats"), filter: "agNumberColumnFilter" },
    { field: "status", headerName: t("common.fields.bookingStatus"), cellDataType: "text", valueFormatter: (params) => BOOKING_STATUS_AR[params.value as keyof typeof BOOKING_STATUS_AR] ?? params.value },
    { field: "paymentStatus", headerName: t("fleetOwners.fleets.detail.tabs.paymentColumn"), cellDataType: "text", valueFormatter: (params) => PAYMENT_STATUS_AR[params.value as keyof typeof PAYMENT_STATUS_AR] ?? params.value },
    { field: "totalAmount", headerName: t("common.fields.total"), filter: "agNumberColumnFilter", valueFormatter: (params) => (params.value == null ? "—" : String(params.value)) },
  ];

  return (
    <section className="panel-card p-5 sm:p-6">
      <TabHeader title={t("fleetOwners.fleets.detail.tabs.bookingsTitle")} actionLabel={t("fleetOwners.fleets.detail.tabs.addBooking")} onAction={() => setCreateOpen(true)} />
      <ListingShell error={error?.message ?? null} isLoading={isLoading} skeleton={<TableSkeleton rows={8} columns={6} />}>
        <CursorList<Booking>
          gridId={`fleet-bookings-${fleetId}`}
          initialItems={page?.items ?? []}
          initialCursor={page?.nextCursor ?? null}
          loadMore={async (cursor) => {
            const result = await fetchBookingsPage(fleetId, cursor);
            if (!result.ok) throw new Error(result.message);
            return result.data;
          }}
          keyOf={(booking) => booking.id}
          columnDefs={columns}
          emptyMessage={t("fleetOwners.fleets.detail.tabs.bookingsEmpty")}
          renderItem={(booking) => (
            <RowActionsMenu
              label={t("fleetOwners.fleets.detail.tabs.bookingRowActions")}
              actions={[
                { label: t("common.actions.openDetails"), href: `/bookings/${booking.id}` },
                { label: t("common.actions.delete"), danger: true, onSelect: () => void removeBooking(booking) },
              ]}
            />
          )}
        />
      </ListingShell>
      <CreateBookingDialog
        open={createOpen}
        onCreated={(booking) => upsertInCursorList(queryClient, qk.fleetBookings(fleetId), booking)}
        onClose={() => setCreateOpen(false)}
      />
    </section>
  );
}

export function FleetReportsTab({ fleetId }: { fleetId: string }) {
  const [state, setState] = useState<{ fleetId: string; data: FleetReports | null; error: string | null }>({
    fleetId,
    data: null,
    error: null,
  });

  useEffect(() => {
    let active = true;
    fetchFleetReports(fleetId).then((result) => {
      if (!active) return;
      if (result.ok) setState({ fleetId, data: result.data, error: null });
      else setState({ fleetId, data: null, error: result.message });
    });
    return () => { active = false; };
  }, [fleetId]);

  const isCurrent = state.fleetId === fleetId;
  const data = isCurrent ? state.data : null;
  const error = isCurrent ? state.error : null;
  const reportColumns: CommunityColumnDef<FleetReport>[] = [
    { field: "note", headerName: t("fleetOwners.fleets.detail.tabs.reportNote"), filter: "agTextColumnFilter" },
    { field: "createdAt", headerName: t("common.fields.date"), filter: "agDateColumnFilter", valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString("ar-EG") : "—" },
  ];

  return (
    <section className="panel-card p-5 sm:p-6">
      <TabHeader title={t("fleetOwners.fleets.detail.tabs.reportsTitle")} />
      <ListingShell error={error} isLoading={!data} skeleton={<ReportsTabSkeleton />}>
        {data && <div className="space-y-5">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#eaf6ff] p-4"><dt className="text-sm text-[#5e6b78]">{t("fleetOwners.fleets.detail.tabs.avgBusRating")}</dt><dd className="mt-1 text-xl font-bold text-[#00134c]">{data.ratingSummary.busAvg?.toFixed(1) ?? "—"}</dd></div>
            <div className="rounded-xl bg-[#eaf6ff] p-4"><dt className="text-sm text-[#5e6b78]">{t("fleetOwners.fleets.detail.tabs.avgDriverRating")}</dt><dd className="mt-1 text-xl font-bold text-[#00134c]">{data.ratingSummary.driverAvg?.toFixed(1) ?? "—"}</dd></div>
            <div className="rounded-xl bg-[#eaf6ff] p-4"><dt className="text-sm text-[#5e6b78]">{t("fleetOwners.fleets.detail.tabs.ratedBookings")}</dt><dd className="mt-1 text-xl font-bold text-[#00134c]">{data.ratingSummary.count}</dd></div>
          </dl>
          <CursorList<FleetReport>
            gridId={`fleet-reports-${fleetId}`}
            initialItems={data.reports}
            initialCursor={null}
            loadMore={async () => ({ items: [], nextCursor: null })}
            keyOf={(report) => report.id}
            columnDefs={reportColumns}
            withActions={false}
            emptyMessage={t("fleetOwners.fleets.detail.tabs.reportsEmpty")}
          />
        </div>}
      </ListingShell>
    </section>
  );
}
