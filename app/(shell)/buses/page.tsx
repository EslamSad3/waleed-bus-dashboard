"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { deleteBus, fetchBusesPage, type Bus } from "@/lib/actions/buses";
import { fetchFleetsPage } from "@/lib/actions/fleets";
import { mapWithConcurrency } from "@/lib/actions/http";
import { CreateBusDialog } from "@/components/buses/create-bus-dialog";
import { EditBusDialog } from "@/components/buses/edit-bus-dialog";
import { TableSkeleton } from "@/components/ui/skeletons";
import { qk, removeFromCursorList, useDataQuery, useQueryClient } from "@/lib/queries";

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
    if (!(await confirm({ title: "تأكيد المسح", description: `الإجراء ده مينفعش يتراجع — تمسح العربية «${bus.plateNumber || bus.registrationNumber}»؟ لازم تكون من غير رحلات أو تعيينات سواق.`, confirmLabel: "مسح", destructive: true }))) return;
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
        <div className="min-w-0 flex-1">
          <h1 className="page-title">العربيات</h1>
          <p className="page-description">كل العربيات في الأساطيل المسجلة، مع حالتها وبيانات تشغيلها.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>عربية جديدة</Button>
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
                aria-label="بحث برقم التسجيل أو اللوحة أو الأسطول"
                placeholder="رقم التسجيل أو اللوحة أو الأسطول"
                value={listFilters.q ?? ""}
                onChange={(event) => setListFilters((current) => ({ ...current, q: event.target.value }))}
                className="w-full bg-white md:w-auto md:min-w-0 md:max-w-72 md:basis-64 md:flex-1"
              />
              <select aria-label="الحالة" value={status} onChange={(event) => setListFilters((current) => ({ ...current, status: event.target.value }))} className="select-field w-full md:w-28">
                <option value="all">الكل</option>
                <option value="active">نشط</option>
                <option value="inactive">موقوف</option>
              </select>
            </div>
          }
          emptyMessage="لا توجد عربيات مسجلة في الأساطيل."
          renderItem={(bus) => (
            <RowActionsMenu
              label={`إجراءات عربية ${bus.plateNumber || bus.registrationNumber}`}
              actions={[
                { label: "فتح التفاصيل", href: `/buses/${bus.id}?fleetId=${bus.fleetId}` },
                { label: "تعديل", onSelect: () => setBusForEdit(bus) },
                { label: "مسح", danger: true, onSelect: () => void removeBus(bus) },
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
