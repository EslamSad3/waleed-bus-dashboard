"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CursorList } from "@/components/tables/cursor-list";
import { fetchBusesPage, type Bus } from "@/lib/actions/buses";
import { fetchTripsPage, TRIP_STATUS_AR, type Trip } from "@/lib/actions/trips";
import { fetchBookingsPage, BOOKING_STATUS_AR, type Booking } from "@/lib/actions/bookings";
import { fetchFleetReports, type FleetReports } from "@/lib/actions/reports";
import type { ActionResult, CursorPage } from "@/lib/actions/http";

type ListingState<T> = { items: T[]; nextCursor: string | null };
type FetchPage<T> = (fleetId: string, cursor: string | null) => Promise<ActionResult<CursorPage<T>>>;

function useFleetListing<T>(fleetId: string, fetchPage: FetchPage<T>) {
  const [state, setState] = useState<{ fleetId: string; first: ListingState<T> | null; error: string | null }>({
    fleetId,
    first: null,
    error: null,
  });

  useEffect(() => {
    let active = true;
    fetchPage(fleetId, null).then((result) => {
      if (!active) return;
      if (result.ok) setState({ fleetId, first: result.data, error: null });
      else setState({ fleetId, first: null, error: result.message });
    });
    return () => { active = false; };
  }, [fleetId, fetchPage]);

  const isCurrent = state.fleetId === fleetId;
  return {
    first: isCurrent ? state.first : null,
    error: isCurrent ? state.error : null,
  };
}

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

function TabHeader({ title, actionHref, actionLabel }: { title: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="section-title">{title}</h2>
      {actionHref && actionLabel ? <Button asChild size="sm"><Link href={actionHref}>{actionLabel}</Link></Button> : null}
    </div>
  );
}

export function FleetBusesTab({ fleetId }: { fleetId: string }) {
  const { first, error } = useFleetListing<Bus>(fleetId, fetchBusesPage);
  return (
    <section className="panel-card p-5 sm:p-6">
      <TabHeader title="أتوبيسات الأسطول" actionHref="/buses/new" actionLabel="إضافة أتوبيس" />
      <ListingShell error={error} isLoading={!first}>
        {first && <CursorList<Bus>
          key={fleetId}
          initialItems={first.items}
          initialCursor={first.nextCursor}
          loadMore={(cursor) => fetchBusesPage(fleetId, cursor).then((result) => {
            if (!result.ok) throw new Error(result.message);
            return result.data;
          })}
          keyOf={(bus) => bus.id}
          emptyMessage="لا توجد أتوبيسات مسجلة في هذا الأسطول"
          renderItem={(bus) => (
            <Link href={`/buses/${bus.id}`} className="list-card">
              <span className="font-semibold text-[#1a1a1a]"><span dir="ltr">{bus.registrationNumber}</span>{bus.plateNumber ? <span className="text-sm text-[#606060]"> · <span dir="ltr">{bus.plateNumber}</span></span> : null}</span>
              <span className="flex items-center gap-3 text-sm text-[#606060]"><span>السعة <span dir="ltr">{bus.capacity}</span></span><span className={bus.isActive ? "status-pill" : "status-pill status-pill-muted"}>{bus.isActive ? "نشط" : "موقوف"}</span></span>
            </Link>
          )}
        />}
      </ListingShell>
    </section>
  );
}

export function FleetTripsTab({ fleetId }: { fleetId: string }) {
  const { first, error } = useFleetListing<Trip>(fleetId, fetchTripsPage);
  return (
    <section className="panel-card p-5 sm:p-6">
      <TabHeader title="رحلات الأسطول" actionHref="/trips/new" actionLabel="إضافة رحلة" />
      <ListingShell error={error} isLoading={!first}>
        {first && <CursorList<Trip>
          key={fleetId}
          initialItems={first.items}
          initialCursor={first.nextCursor}
          loadMore={(cursor) => fetchTripsPage(fleetId, cursor).then((result) => {
            if (!result.ok) throw new Error(result.message);
            return result.data;
          })}
          keyOf={(trip) => trip.id}
          emptyMessage="لا توجد رحلات مسجلة في هذا الأسطول"
          renderItem={(trip) => (
            <Link href={`/trips/${trip.id}`} className="list-card">
              <span className="font-semibold text-[#1a1a1a]">{trip.origin} ← {trip.destination}</span>
              <span className="flex flex-wrap items-center gap-2 text-sm text-[#5e6b78]"><span className={trip.status === "CANCELLED" ? "status-pill status-pill-muted" : "status-pill"}>{TRIP_STATUS_AR[trip.status]}</span><time dateTime={trip.departAt}>{new Date(trip.departAt).toLocaleString("en-EG")}</time></span>
            </Link>
          )}
        />}
      </ListingShell>
    </section>
  );
}

export function FleetBookingsTab({ fleetId }: { fleetId: string }) {
  const { first, error } = useFleetListing<Booking>(fleetId, fetchBookingsPage);
  return (
    <section className="panel-card p-5 sm:p-6">
      <TabHeader title="حجوزات الأسطول" actionHref="/bookings/new" actionLabel="إضافة حجز" />
      <ListingShell error={error} isLoading={!first}>
        {first && <CursorList<Booking>
          key={fleetId}
          initialItems={first.items}
          initialCursor={first.nextCursor}
          loadMore={(cursor) => fetchBookingsPage(fleetId, cursor).then((result) => {
            if (!result.ok) throw new Error(result.message);
            return result.data;
          })}
          keyOf={(booking) => booking.id}
          emptyMessage="لا توجد حجوزات مسجلة في هذا الأسطول"
          renderItem={(booking) => (
            <Link href={`/bookings/${booking.id}`} className="list-card">
              <span className="font-semibold text-[#1a1a1a]">{booking.passengerName}{booking.passengerPhone ? <span className="text-sm text-[#606060]"> · <span dir="ltr">{booking.passengerPhone}</span></span> : null}</span>
              <span className="flex flex-wrap items-center gap-2 text-sm text-[#5e6b78]"><span>كراسي <span dir="ltr">{booking.seats}</span></span><span className={booking.status === "CONFIRMED" ? "status-pill" : "status-pill status-pill-muted"}>{BOOKING_STATUS_AR[booking.status]}</span></span>
            </Link>
          )}
        />}
      </ListingShell>
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

  return (
    <section className="panel-card p-5 sm:p-6">
      <TabHeader title="تقارير ومراجعات الأسطول" />
      <ListingShell error={error} isLoading={!data}>
        {data && <div className="space-y-5">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#edf6fc] p-4"><dt className="text-sm text-[#5e6b78]">متوسط تقييم الأتوبيس</dt><dd className="mt-1 text-xl font-bold text-[#204c6b]">{data.ratingSummary.busAvg?.toFixed(1) ?? "—"}</dd></div>
            <div className="rounded-xl bg-[#edf6fc] p-4"><dt className="text-sm text-[#5e6b78]">متوسط تقييم السائق</dt><dd className="mt-1 text-xl font-bold text-[#204c6b]">{data.ratingSummary.driverAvg?.toFixed(1) ?? "—"}</dd></div>
            <div className="rounded-xl bg-[#edf6fc] p-4"><dt className="text-sm text-[#5e6b78]">الحجوزات المُقيّمة</dt><dd className="mt-1 text-xl font-bold text-[#204c6b]">{data.ratingSummary.count}</dd></div>
          </dl>
          {data.reports.length === 0 ? <p className="empty-state">لا توجد بلاغات ركاب لهذا الأسطول</p> : <ul className="flex flex-col gap-2.5">{data.reports.map((report) => <li key={report.id} className="list-card block"><p className="font-semibold text-[#1a1a1a]">بلاغ راكب</p><p className="mt-1 text-sm text-[#5e6b78]">{report.note}</p><time className="mt-2 block text-xs text-[#71808d]" dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString("en-EG")}</time></li>)}</ul>}
        </div>}
      </ListingShell>
    </section>
  );
}
