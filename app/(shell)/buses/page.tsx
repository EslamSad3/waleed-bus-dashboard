"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { fetchBusesPage, type Bus } from "@/lib/actions/buses";
import { fetchFleetsPage } from "@/lib/actions/fleets";

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
  const results = await Promise.all(
    states.map(async (state) => {
      const result = await fetchBusesPage(state.fleetId, state.cursor);
      if (!result.ok) throw new Error(result.message);
      return { state, page: result.data };
    }),
  );
  const nextStates = results.map(({ state, page }) => ({ ...state, cursor: page.nextCursor }));
  const items = results.flatMap(({ state, page }) => page.items.map((bus) => ({ ...bus, fleetName: state.fleetName })));
  return {
    items,
    nextCursor: nextStates.some((state) => state.cursor) ? JSON.stringify(nextStates) : null,
  };
}

export default function BusesPage() {
  const [first, setFirst] = useState<BusAggregatePage | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [listFilters, setListFilters] = useState<{ q?: string; status?: string }>({});

  useEffect(() => {
    fetchAggregateBusPage(null)
      .then((page) => { setFirst(page); setFailed(null); })
      .catch((error: Error) => setFailed(error.message));
  }, []);

  const query = (listFilters.q ?? "").trim();
  const status = listFilters.status ?? "all";
  const predicate = (bus: BusRow) =>
    (!query || bus.registrationNumber.includes(query) || (bus.plateNumber ?? "").includes(query) || bus.fleetName.includes(query)) &&
    (status === "all" || (status === "active" ? bus.isActive : !bus.isActive));

  const columns: CommunityColumnDef<BusRow>[] = [
    { field: "registrationNumber", headerName: "رقم التسجيل", filter: "agTextColumnFilter" },
    { field: "plateNumber", headerName: "رقم اللوحة", filter: "agTextColumnFilter" },
    { field: "fleetName", headerName: "اسم الأسطول", filter: "agTextColumnFilter" },
    { field: "capacity", headerName: "السعة", filter: "agNumberColumnFilter" },
    { field: "isActive", headerName: "الحالة", filter: "agTextColumnFilter", cellDataType: "text", valueFormatter: (params) => params.value ? "نشط" : "موقوف" },
    { field: "createdAt", headerName: "تاريخ الإنشاء", filter: "agDateColumnFilter", valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString("ar-EG") : "—" },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">الأتوبيسات</h1>
          <p className="page-description">كل الأتوبيسات في الأساطيل المسجلة، مع حالتها وبيانات تشغيلها.</p>
        </div>
        <Button asChild><Link href="/buses/new">أتوبيس جديد</Link></Button>
      </div>

      {failed ? <p role="alert" className="text-sm text-red-600">{failed}</p> : null}
      {!first ? <p className="text-sm text-[#606060]">جاري تحميل الأتوبيسات…</p> : (
        <CursorList<BusRow>
          initialItems={first.items}
          initialCursor={first.nextCursor}
          loadMore={fetchAggregateBusPage}
          keyOf={(bus) => bus.id}
          filter={predicate}
          columnDefs={columns}
          filterBar={
            <div className="contents">
              <Input
                aria-label="بحث برقم التسجيل أو اللوحة أو الأسطول"
                placeholder="رقم التسجيل أو اللوحة أو الأسطول"
                value={listFilters.q ?? ""}
                onChange={(event) => setListFilters((current) => ({ ...current, q: event.target.value }))}
                className="max-w-xs bg-white"
              />
              <select aria-label="الحالة" value={status} onChange={(event) => setListFilters((current) => ({ ...current, status: event.target.value }))} className="select-field">
                <option value="all">الكل</option>
                <option value="active">نشط</option>
                <option value="inactive">موقوف</option>
              </select>
            </div>
          }
          emptyMessage="لا توجد أتوبيسات مسجلة في الأساطيل."
          renderItem={(bus) => <Link href={`/buses/${bus.id}`} className="list-card"><span className="font-semibold"><span dir="ltr">{bus.registrationNumber}</span><span className="mt-1 block text-xs text-[#606060]">{bus.fleetName}</span></span><span className="text-sm text-[#606060]">فتح</span></Link>}
        />
      )}
    </div>
  );
}
