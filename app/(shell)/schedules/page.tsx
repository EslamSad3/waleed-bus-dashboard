"use client";

import { useCallback, useMemo, useState } from "react";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeletons";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  fetchSystemSchedulesPage,
  deleteSchedule,
  fetchScheduleCalendarPage,
  type TripSchedule,
  type SystemTripSchedule,
} from "@/lib/actions/schedules";
import { fetchTrip, TRIP_STATUS_AR, type Trip } from "@/lib/actions/trips";
import { CreateScheduleDialog } from "@/components/schedules/create-schedule-dialog";
import { EditScheduleDialog } from "@/components/schedules/edit-schedule-dialog";
import { Dialog } from "@/components/ui/dialog";
import { qk, useApiInfiniteQuery, useApiQuery, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";
import { CalendarDays, Plus, Pencil, Trash2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function SchedulesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<TripSchedule | null>(null);
  const [occurrencesSchedule, setOccurrencesSchedule] = useState<TripSchedule | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: page, isLoading, error } = useApiQuery(
    qk.schedules("all"),
    () => fetchSystemSchedulesPage(null),
  );

  const searchPredicate = useCallback(
    (s: SystemTripSchedule) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        Boolean(s.ownerName?.toLowerCase().includes(q)) ||
        (s.line?.name && s.line.name.toLowerCase().includes(q)) ||
        Boolean(s.bus?.plateNumber && s.bus.plateNumber.toLowerCase().includes(q)) ||
        Boolean(s.driver?.name && s.driver.name.toLowerCase().includes(q))
      );
    },
    [search],
  );

  const handleDelete = useCallback(
    async (schedule: TripSchedule) => {
      const ok = await confirm({
        title: t("schedules.deleteDialog.title"),
        description: t("schedules.deleteDialog.description"),
        confirmLabel: t("schedules.deleteDialog.confirm"),
        destructive: true,
      });
      if (!ok) return;

      const res = await deleteSchedule(schedule.ownerId, schedule.lineId, schedule.id);
      if (res.ok) {
        setDeleteError(null);
        void queryClient.invalidateQueries({ queryKey: ["schedules"] });
        queryClient.removeQueries({ queryKey: qk.scheduleTrips(schedule.ownerId, schedule.lineId, schedule.id) });
      } else {
        setDeleteError(res.message);
      }
    },
    [confirm, queryClient],
  );

  const openOccurrences = useCallback((schedule: TripSchedule) => {
    setOccurrencesSchedule(schedule);
  }, []);

  const columns: CommunityColumnDef<SystemTripSchedule>[] = useMemo(
    () => [
      {
        field: "ownerName",
        headerName: t("common.fields.owner"),
        width: 180,
        valueGetter: (params) => params.data?.ownerName ?? t("common.value.withoutName"),
      },
      {
        field: "line",
        headerName: t("schedules.columns.line"),
        width: 220,
        valueGetter: (params) => params.data?.line.name ?? "—",
      },
      {
        field: "departTime",
        headerName: t("schedules.columns.departureTime"),
        width: 130,
        cellRenderer: (params: { value: string }) => (
          <span className="font-mono text-xs font-bold text-slate-900" dir="ltr">
            {params.value}
          </span>
        ),
      },
      {
        field: "daysOfWeek",
        headerName: t("schedules.columns.daysOfWeek"),
        width: 220,
        cellRenderer: (params: { value: number[] }) => {
          const days = params.value ?? [0, 1, 2, 3, 4, 5, 6];
          return (
            <div className="flex flex-wrap gap-1">
              {days.map((d) => (
                <span
                  key={d}
                  className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800"
                >
                  {t(`schedules.daysShort.${d}` as any)}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        field: "bus",
        headerName: t("schedules.columns.bus"),
        width: 140,
        valueGetter: (params) => params.data?.bus.plateNumber ?? t("common.value.withoutName"),
      },
      {
        field: "driver",
        headerName: t("schedules.columns.driver"),
        width: 140,
        valueGetter: (params) => params.data?.driver?.name ?? t("common.value.unassigned"),
      },
      {
        field: "isActive",
        headerName: t("schedules.columns.status"),
        width: 140,
        cellRenderer: (params: { data: TripSchedule }) => {
          const { isActive, pausedReason } = params.data;
          if (pausedReason) {
            return (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800"
                title={pausedReason}
              >
                <AlertCircle className="size-3" />
                {t("schedules.status.paused", { reason: pausedReason })}
              </span>
            );
          }
          return (
            <span
              className={cn(
                "status-pill text-xs font-bold",
                isActive
                  ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                  : "border-slate-200 bg-slate-100 text-slate-600",
              )}
            >
              {isActive ? t("common.status.active") : t("common.status.inactive")}
            </span>
          );
        },
      },
      {
        field: "materializedThrough",
        headerName: t("schedules.columns.materializedThrough"),
        width: 140,
        valueFormatter: (params) => (params.value ? String(params.value) : "—"),
      },
      {
        colId: "actions",
        headerName: t("schedules.columns.actions"),
        width: 160,
        minWidth: 160,
        pinned: "left",
        sortable: false,
        filter: false,
        exportable: false,
        cellRenderer: (params: { data: TripSchedule }) => (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => openOccurrences(params.data)}
              title={t("schedules.tabs.occurrences")}
              aria-label={t("schedules.tabs.occurrences")}
            >
              <CalendarDays className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditingSchedule(params.data)}
              title={t("common.actions.edit")}
              aria-label={t("common.actions.edit")}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleDelete(params.data)}
              title={t("common.actions.delete")}
              aria-label={t("common.actions.delete")}
            >
              <Trash2 className="size-4 text-red-500" />
            </Button>
          </div>
        ),
      },
    ],
    [handleDelete, openOccurrences],
  );

  return (
    <div className="dashboard-page space-y-6">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("schedules.title")}</h1>
          <p className="page-description">{t("schedules.description")}</p>
        </div>
        <Button
          type="button"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" /> {t("schedules.createButton")}
        </Button>
      </div>

      <div className="rounded-2xl border border-[#dce8ef] bg-white p-4 shadow-sm">
        <div>
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("schedules.filter.searchPlaceholder")}
            aria-label={t("schedules.filter.searchPlaceholder")}
          />
        </div>
      </div>

      {deleteError ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {deleteError}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error.message || t("common.error.somethingWentWrong")}
        </p>
      ) : null}

      {isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : (
        <CursorList<SystemTripSchedule>
          gridId="schedules-list"
          scopeKey="all-owners"
          initialItems={page?.items ?? []}
          initialCursor={page?.nextCursor ?? null}
          filter={searchPredicate}
          loadMore={(cursor) =>
            fetchSystemSchedulesPage(cursor).then((res) => {
              if (!res.ok) throw new Error(res.message);
              return res.data;
            })
          }
          keyOf={(row) => row.id}
          columnDefs={columns}
          emptyMessage={t("schedules.empty")}
        />
      )}

      {createOpen && (
        <CreateScheduleDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {editingSchedule && (
        <EditScheduleDialog
          schedule={editingSchedule}
          open={Boolean(editingSchedule)}
          onClose={() => setEditingSchedule(null)}
        />
      )}

      {occurrencesSchedule && (
        <OccurrencesDialog
          key={`${occurrencesSchedule.ownerId}:${occurrencesSchedule.lineId}:${occurrencesSchedule.id}`}
          schedule={occurrencesSchedule}
          onClose={() => setOccurrencesSchedule(null)}
        />
      )}
    </div>
  );
}

function OccurrencesDialog({
  schedule,
  onClose,
}: {
  schedule: TripSchedule;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const query = useApiInfiniteQuery(
    qk.scheduleTrips(schedule.ownerId, schedule.lineId, schedule.id),
    (cursor) => fetchScheduleCalendarPage(schedule.ownerId, schedule.lineId, schedule.id, cursor,
      (trip) => queryClient.fetchQuery({
        queryKey: qk.trip(trip.ownerId, trip.lineId, trip.id),
        queryFn: async () => {
          const result = await fetchTrip(trip.ownerId, trip.lineId, trip.id);
          if (!result.ok) throw new Error(result.message);
          return result.data;
        },
      })),
    { staleTime: 5 * 60_000 },
  );
  const trips = query.data?.pages.flatMap((page) => page.items) ?? [];
  const nextCursor = query.data?.pages.at(-1)?.nextCursor ?? null;
  const columns: CommunityColumnDef<Trip>[] = [
    {
      colId: "line",
      headerName: t("schedules.columns.line"),
      minWidth: 240,
      wrapText: true,
      autoHeight: true,
      valueGetter: ({ data }) => data
        ? `${data.line?.name ?? "—"} · ${data.origin ?? "—"} ← ${data.destination ?? "—"}` : "",
    },
    {
      colId: "bus",
      headerName: t("schedules.columns.bus"),
      width: 160,
      valueGetter: ({ data }) => data?.bus?.plateNumber ?? data?.bus?.registrationNumber ?? t("common.value.withoutName"),
    },
    {
      colId: "driver",
      headerName: t("schedules.columns.driver"),
      width: 180,
      wrapText: true,
      autoHeight: true,
      valueGetter: ({ data }) => data?.driver?.name ?? t("common.value.unassigned"),
    },
    {
      colId: "stops",
      headerName: t("schedules.columns.stops"),
      minWidth: 360,
      wrapText: true,
      autoHeight: true,
      valueGetter: ({ data }) => [...(data?.stops ?? [])].sort((a, b) => a.stopOrder - b.stopOrder)
        .map((stop) => `${stop.stopOrder}. ${stop.name} · ${stop.scheduledAt
          ? new Date(stop.scheduledAt).toLocaleString("ar-EG", {
            timeZone: "Africa/Cairo", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          }) : "—"}`).join("\n"),
      cellStyle: { whiteSpace: "pre-line", paddingBlock: "8px" },
    },
    {
      field: "departAt",
      headerName: t("schedules.columns.departureTime"),
      flex: 1,
      minWidth: 240,
      valueFormatter: ({ value }) => new Date(String(value)).toLocaleString("ar-EG", {
        timeZone: "Africa/Cairo", year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      }),
    },
    {
      field: "status",
      headerName: t("schedules.columns.status"),
      width: 160,
      valueFormatter: ({ value }) => TRIP_STATUS_AR[value as Trip["status"]] ?? String(value),
    },
    {
      colId: "actions",
      headerName: t("schedules.columns.actions"),
      pinned: "left",
      width: 180,
      sortable: false,
      filter: false,
      exportable: false,
      cellRenderer: ({ data }: { data: Trip }) => (
        <Link href={`/trips/${data.id}?ownerId=${data.ownerId}&lineId=${data.lineId}`}
          className="text-xs font-bold text-sky-600 hover:underline">
          {t("common.actions.openDetails")}
        </Link>
      ),
    },
  ];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("schedules.tabs.occurrences")}
      description={t("schedules.occurrencesNotice")}
      size="xl"
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
          {t("schedules.occurrencesCurrentData")}
        </div>

        <AgGridTable<Trip>
          gridId="schedule-occurrences"
          rows={trips}
          columnDefs={columns}
          nextCursor={nextCursor}
          loadMore={async () => { await query.fetchNextPage(); }}
          loading={query.isLoading || query.isFetchingNextPage}
          errorMessage={query.error?.message}
          emptyMessage={t("schedules.occurrencesEmpty")}
          getRowId={(trip) => trip.id}
        />
        {query.error && !trips.length ? (
          <Button type="button" variant="outline" onClick={() => void query.refetch()}>
            {t("common.actions.retry")}
          </Button>
        ) : null}

        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.actions.close")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
