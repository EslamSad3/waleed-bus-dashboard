"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { Button } from "@/components/ui/button";
import { CreateBusDialog } from "@/components/buses/create-bus-dialog";
import { CreateTripDialog } from "@/components/trips/create-trip-dialog";
import { CreateBookingDialog } from "@/components/bookings/create-booking-dialog";
import { disableBus, fetchBusesPage, reactivateBus, type Bus } from "@/lib/actions/buses";
import { fetchTripsPage, TRIP_STATUS_AR, type Trip } from "@/lib/actions/trips";
import { fetchBookingsPage, BOOKING_STATUS_AR, PAYMENT_STATUS_AR, type Booking } from "@/lib/actions/bookings";
import { fetchFleetReports, type FleetReports } from "@/lib/actions/reports";
import { qk, upsertInList, useApiQuery, useQueryClient } from "@/lib/queries";
import type { ActionResult, CursorPage } from "@/lib/actions/http";

type ListingState<T> = { items: T[]; nextCursor: string | null };
type FetchPage<T> = (fleetId: string, cursor: string | null) => Promise<ActionResult<CursorPage<T>>>;
type FleetReport = FleetReports["reports"][number];

function ListingShell({
  children,
  error,
  isLoading,
}: {
  children: ReactNode;
  error: string | null;
  isLoading: boolean;
}) {
  if (error) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (isLoading) return <p className="rounded-xl bg-white p-5 text-sm text-[#606060]">جاري التحميل…</p>;
  return <>{children}</>;
}

function TabHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="section-title mb-0">{title}</h2>
      {actionLabel && onAction ? (
        <Button type="button" size="sm" onClick={onAction}>{actionLabel}</Button>
      ) : null}
    </div>
  );
}

export function FleetBusesTab({ fleetId }: { fleetId: string }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: page, isLoading, error } = useApiQuery(qk.fleetBuses(fleetId), () => fetchBusesPage(fleetId, null));

  async function toggleActive(bus: Bus) {
    const result = bus.isActive ? await disableBus(fleetId, bus.id) : await reactivateBus(fleetId, bus.id);
    if (!result.ok) return;
    upsertInList(queryClient, qk.fleetBuses(fleetId), result.data);
  }

  const columns: CommunityColumnDef<Bus>[] = [
    { field: "registrationNumber", headerName: "رقم التسجيل", filter: "agTextColumnFilter" },
    { field: "plateNumber", headerName: "رقم اللوحة", filter: "agTextColumnFilter", valueFormatter: (params) => params.value || "—" },
    { field: "capacity", headerName: "السعة", filter: "agNumberColumnFilter" },
    { field: "isActive", headerName: "الحالة", filter: "agTextColumnFilter", cellDataType: "text", valueFormatter: (params) => (params.value ? "نشط" : "موقوف") },
    { field: "createdAt", headerName: "تاريخ الإنشاء", filter: "agDateColumnFilter", valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleDateString("ar-EG") : "—") },
  ];

  return (
    <section className="panel-card p-5 sm:p-6">
      <TabHeader title="عربيات الأسطول" actionLabel="إضافة عربية" onAction={() => setCreateOpen(true)} />
      <ListingShell error={error?.message ?? null} isLoading={isLoading}>
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
          emptyMessage="لا توجد عربيات مسجلة في هذا الأسطول"
          renderItem={(bus) => (
            <RowActionsMenu
              label={`إجراءات عربية ${bus.registrationNumber}`}
              actions={[
                { label: "فتح التفاصيل", href: `/buses/${bus.id}?fleetId=${fleetId}` },
                { label: bus.isActive ? "إيقاف" : "إعادة تشغيل", onSelect: () => toggleActive(bus) },
              ]}
            />
          )}
        />
      </ListingShell>
      <CreateBusDialog
        open={createOpen}
        lockedFleetId={fleetId}
        onCreated={(bus) => upsertInList(queryClient, qk.fleetBuses(fleetId), bus)}
        onClose={() => setCreateOpen(false)}
      />
    </section>
  );
}

export function FleetTripsTab({ fleetId }: { fleetId: string }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: page, isLoading, error } = useApiQuery(qk.fleetTrips(fleetId), () => fetchTripsPage(fleetId, null));

  const columns: CommunityColumnDef<Trip>[] = [
    { field: "origin", headerName: "البداية", filter: "agTextColumnFilter" },
    { field: "destination", headerName: "الوجهة", filter: "agTextColumnFilter" },
    { field: "departAt", headerName: "الميعاد", filter: "agDateColumnFilter", valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleString("ar-EG") : "—") },
    { field: "status", headerName: "الحالة", filter: "agTextColumnFilter", cellDataType: "text", valueFormatter: (params) => TRIP_STATUS_AR[params.value as Trip["status"]] ?? params.value },
  ];

  return (
    <section className="panel-card p-5 sm:p-6">
      <TabHeader title="رحلات الأسطول" actionLabel="إضافة رحلة" onAction={() => setCreateOpen(true)} />
      <ListingShell error={error?.message ?? null} isLoading={isLoading}>
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
          emptyMessage="لا توجد رحلات مسجلة في هذا الأسطول"
          renderItem={(trip) => (
            <RowActionsMenu
              label="إجراءات الرحلة"
              actions={[{ label: "فتح التفاصيل", href: `/trips/${trip.id}` }]}
            />
          )}
        />
      </ListingShell>
      <CreateTripDialog
        open={createOpen}
        onCreated={(trip) => upsertInList(queryClient, qk.fleetTrips(fleetId), trip)}
        onClose={() => setCreateOpen(false)}
      />
    </section>
  );
}

export function FleetBookingsTab({ fleetId }: { fleetId: string }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: page, isLoading, error } = useApiQuery(qk.fleetBookings(fleetId), () => fetchBookingsPage(fleetId, null));

  const columns: CommunityColumnDef<Booking>[] = [
    { field: "passengerName", headerName: "الراكب", filter: "agTextColumnFilter" },
    { field: "seats", headerName: "المقاعد", filter: "agNumberColumnFilter" },
    { field: "status", headerName: "حالة الحجز", cellDataType: "text", valueFormatter: (params) => BOOKING_STATUS_AR[params.value as keyof typeof BOOKING_STATUS_AR] ?? params.value },
    { field: "paymentStatus", headerName: "الدفع", cellDataType: "text", valueFormatter: (params) => PAYMENT_STATUS_AR[params.value as keyof typeof PAYMENT_STATUS_AR] ?? params.value },
    { field: "totalAmount", headerName: "الإجمالي", filter: "agNumberColumnFilter", valueFormatter: (params) => (params.value == null ? "—" : String(params.value)) },
  ];

  return (
    <section className="panel-card p-5 sm:p-6">
      <TabHeader title="حجوزات الأسطول" actionLabel="إضافة حجز" onAction={() => setCreateOpen(true)} />
      <ListingShell error={error?.message ?? null} isLoading={isLoading}>
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
          emptyMessage="لا توجد حجوزات مسجلة في هذا الأسطول"
          renderItem={(booking) => (
            <RowActionsMenu
              label="إجراءات الحجز"
              actions={[{ label: "فتح التفاصيل", href: `/bookings/${booking.id}` }]}
            />
          )}
        />
      </ListingShell>
      <CreateBookingDialog
        open={createOpen}
        onCreated={(booking) => upsertInList(queryClient, qk.fleetBookings(fleetId), booking)}
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
    { field: "note", headerName: "ملاحظة البلاغ", filter: "agTextColumnFilter" },
    { field: "createdAt", headerName: "التاريخ", filter: "agDateColumnFilter", valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString("ar-EG") : "—" },
  ];

  return (
    <section className="panel-card p-5 sm:p-6">
      <TabHeader title="تقارير ومراجعات الأسطول" />
      <ListingShell error={error} isLoading={!data}>
        {data && <div className="space-y-5">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#eaf6ff] p-4"><dt className="text-sm text-[#5e6b78]">متوسط تقييم العربية</dt><dd className="mt-1 text-xl font-bold text-[#00134c]">{data.ratingSummary.busAvg?.toFixed(1) ?? "—"}</dd></div>
            <div className="rounded-xl bg-[#eaf6ff] p-4"><dt className="text-sm text-[#5e6b78]">متوسط تقييم السائق</dt><dd className="mt-1 text-xl font-bold text-[#00134c]">{data.ratingSummary.driverAvg?.toFixed(1) ?? "—"}</dd></div>
            <div className="rounded-xl bg-[#eaf6ff] p-4"><dt className="text-sm text-[#5e6b78]">الحجوزات المُقيّمة</dt><dd className="mt-1 text-xl font-bold text-[#00134c]">{data.ratingSummary.count}</dd></div>
          </dl>
          <CursorList<FleetReport>
            gridId={`fleet-reports-${fleetId}`}
            initialItems={data.reports}
            initialCursor={null}
            loadMore={async () => ({ items: [], nextCursor: null })}
            keyOf={(report) => report.id}
            columnDefs={reportColumns}
            withActions={false}
            emptyMessage="لا توجد بلاغات ركاب لهذا الأسطول"
          />
        </div>}
      </ListingShell>
    </section>
  );
}
