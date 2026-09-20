"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { fetchTripsPage, TRIP_STATUS_AR, type Trip } from "@/lib/actions/trips";
import { fetchBusesPage } from "@/lib/actions/buses";
import { fetchSystemDriversPage, type SystemDriverRow } from "@/lib/actions/members";
import { fetchFleetsPage } from "@/lib/actions/fleets";

type TripRow = Trip & { fleetName: string; busName: string; driverName: string };
type FleetCursor = { fleetId: string; fleetName: string; cursor: string | null };
type TripAggregatePage = { items: TripRow[]; nextCursor: string | null };

async function fetchFleetBuses(fleetId: string) {
  const buses = new Map<string, string>();
  let cursor: string | null = null;
  do {
    const result = await fetchBusesPage(fleetId, cursor);
    if (!result.ok) throw new Error(result.message);
    result.data.items.forEach((bus) => buses.set(bus.id, bus.registrationNumber));
    cursor = result.data.nextCursor;
  } while (cursor);
  return buses;
}

async function fetchAssignedDrivers() {
  const drivers = new Map<string, string>();
  let cursor: string | null = null;
  do {
    const result = await fetchSystemDriversPage(cursor);
    if (!result.ok) throw new Error(result.message);
    result.data.items.forEach((driver: SystemDriverRow) => {
      if (driver.assignedBus) drivers.set(driver.assignedBus.id, driver.name || driver.nickname || driver.phoneNumber || "غير معيّن");
    });
    cursor = result.data.nextCursor;
  } while (cursor);
  return drivers;
}

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

async function fetchAggregateTripPage(cursorState: string | null): Promise<TripAggregatePage> {
  const states: FleetCursor[] = cursorState ? JSON.parse(cursorState) as FleetCursor[] : await fetchAllFleetStates();
  const [assignedDrivers, fleetBuses] = await Promise.all([
    fetchAssignedDrivers(),
    Promise.all(states.map(async (state) => [state.fleetId, await fetchFleetBuses(state.fleetId)] as const)),
  ]);
  const busesByFleet = new Map(fleetBuses);
  const results = await Promise.all(
    states.map(async (state) => {
      const result = await fetchTripsPage(state.fleetId, state.cursor);
      if (!result.ok) throw new Error(result.message);
      return { state, page: result.data };
    }),
  );
  const nextStates = results.map(({ state, page }) => ({ ...state, cursor: page.nextCursor }));
  const items = results.flatMap(({ state, page }) => page.items.map((trip) => ({
    ...trip,
    fleetName: state.fleetName,
    busName: busesByFleet.get(state.fleetId)?.get(trip.busId) ?? "غير معيّن",
    driverName: assignedDrivers.get(trip.busId) ?? "غير معيّن",
  })));
  return {
    items,
    nextCursor: nextStates.some((state) => state.cursor) ? JSON.stringify(nextStates) : null,
  };
}

export default function TripsPage() {
  const [first, setFirst] = useState<TripAggregatePage | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [listFilters, setListFilters] = useState<{ q?: string; status?: string; from?: string; to?: string }>({});

  useEffect(() => {
    fetchAggregateTripPage(null).then(setFirst).catch((error: Error) => setFailed(error.message));
  }, []);

  const query = (listFilters.q ?? "").trim();
  const status = listFilters.status ?? "all";
  const from = listFilters.from ?? "";
  const to = listFilters.to ?? "";
  const predicate = (trip: TripRow) =>
    (!query || trip.origin.includes(query) || trip.destination.includes(query) || trip.fleetName.includes(query) || trip.busName.includes(query) || trip.driverName.includes(query)) &&
    (status === "all" || trip.status === status) &&
    (!from || trip.departAt.slice(0, 10) >= from) &&
    (!to || trip.departAt.slice(0, 10) <= to);

  const columns: CommunityColumnDef<TripRow>[] = [
    { field: "origin", headerName: "البداية", filter: "agTextColumnFilter" },
    { field: "destination", headerName: "الوجهة", filter: "agTextColumnFilter" },
    { field: "fleetName", headerName: "اسم الأسطول", filter: "agTextColumnFilter" },
    { field: "busName", headerName: "الأتوبيس", filter: "agTextColumnFilter" },
    { field: "driverName", headerName: "السواق", filter: "agTextColumnFilter" },
    { field: "departAt", headerName: "موعد الرحلة", filter: "agDateColumnFilter", valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString("ar-EG") : "—" },
    { field: "status", headerName: "الحالة", filter: "agTextColumnFilter", valueFormatter: (params) => TRIP_STATUS_AR[params.value as Trip["status"]] ?? params.value },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">الرحلات</h1>
          <p className="page-description">كل الرحلات في الأساطيل المسجلة، مع الخط والميعاد وحالة التشغيل.</p>
        </div>
        <Button asChild><Link href="/trips/new">رحلة جديدة</Link></Button>
      </div>

      {failed ? <p role="alert" className="text-sm text-red-600">{failed}</p> : null}
      {!first ? <p className="text-sm text-[#606060]">جاري تحميل الرحلات…</p> : (
        <CursorList<TripRow>
          initialItems={first.items}
          initialCursor={first.nextCursor}
          loadMore={fetchAggregateTripPage}
          keyOf={(trip) => trip.id}
          filter={predicate}
          columnDefs={columns}
          filterBar={
            <div className="contents">
              <Input aria-label="بحث بالمنشأ أو الوجهة أو الأسطول" placeholder="من / إلى / الأسطول" value={listFilters.q ?? ""} onChange={(event) => setListFilters((current) => ({ ...current, q: event.target.value }))} className="max-w-52 bg-white" />
              <select aria-label="الحالة" value={status} onChange={(event) => setListFilters((current) => ({ ...current, status: event.target.value }))} className="select-field"><option value="all">كل الحالات</option><option value="SCHEDULED">مجدولة</option><option value="DEPARTED">شغالة</option><option value="COMPLETED">خلصت</option><option value="CANCELLED">ملغية</option></select>
              <Input aria-label="من تاريخ" type="date" value={from} onChange={(event) => setListFilters((current) => ({ ...current, from: event.target.value }))} className="max-w-44 bg-white" />
              <Input aria-label="إلى تاريخ" type="date" value={to} onChange={(event) => setListFilters((current) => ({ ...current, to: event.target.value }))} className="max-w-44 bg-white" />
            </div>
          }
          emptyMessage="لا توجد رحلات مسجلة في الأساطيل."
          renderItem={(trip) => <Link href={`/trips/${trip.id}`} className="list-card"><span className="font-semibold">{trip.origin} ← {trip.destination}<span className="mt-1 block text-xs text-[#606060]">{trip.fleetName} · {trip.busName} · {trip.driverName}</span></span><span className="text-sm text-[#606060]">فتح</span></Link>}
        />
      )}
    </div>
  );
}
