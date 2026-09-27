"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { fetchBusesPage, type Bus } from "@/lib/actions/buses";
import { fetchFleetsPage } from "@/lib/actions/fleets";
import { CreateBusDialog } from "@/components/buses/create-bus-dialog";
import { qk, useDataQuery } from "@/lib/queries";

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
  const { data: first, isLoading, error } = useDataQuery<BusAggregatePage>(
    qk.busesAggregate,
    () => fetchAggregateBusPage(null),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [listFilters, setListFilters] = useState<{ q?: string; status?: string }>({});

  const query = (listFilters.q ?? "").trim();
  const status = listFilters.status ?? "all";
  const predicate = (bus: BusRow) =>
    (!query || bus.registrationNumber.includes(query) || (bus.plateNumber ?? "").includes(query) || bus.fleetName.includes(query)) &&
    (status === "all" || (status === "active" ? bus.isActive : !bus.isActive));

  const columns: CommunityColumnDef<BusRow>[] = useMemo(() => [
    { field: "registrationNumber", headerName: "رقم التسجيل", filter: "agTextColumnFilter" },
    { field: "plateNumber", headerName: "رقم اللوحة", filter: "agTextColumnFilter" },
    { field: "fleetName", headerName: "اسم الأسطول", filter: "agTextColumnFilter" },
    { field: "capacity", headerName: "السعة", filter: "agNumberColumnFilter" },
    { field: "isActive", headerName: "الحالة", filter: "agTextColumnFilter", cellDataType: "text", valueFormatter: (params) => params.value ? "نشط" : "موقوف" },
    { field: "createdAt", headerName: "تاريخ الإنشاء", filter: "agDateColumnFilter", valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString("ar-EG") : "—" },
  ], []);

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">العربيات</h1>
          <p className="page-description">كل العربيات في الأساطيل المسجلة، مع حالتها وبيانات تشغيلها.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>عربية جديدة</Button>
      </div>

      {error ? <p role="alert" className="text-sm text-red-600">{error.message}</p> : null}
      {isLoading ? <p className="text-sm text-[#606060]">جاري تحميل العربيات…</p> : (
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
          emptyMessage="لا توجد عربيات مسجلة في الأساطيل."
          renderItem={(bus) => <Link href={`/buses/${bus.id}?fleetId=${bus.fleetId}`} />}
        />
      )}
      <CreateBusDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
