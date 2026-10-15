"use client";

import { useCallback, useMemo, useState } from "react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeletons";
import { OwnerPicker } from "@/components/owners/owner-picker";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  fetchOwnerSchedulesPage,
  deleteSchedule,
  fetchScheduleTrips,
  type TripSchedule,
} from "@/lib/actions/schedules";
import { type Trip } from "@/lib/actions/trips";
import { CreateScheduleDialog } from "@/components/schedules/create-schedule-dialog";
import { EditScheduleDialog } from "@/components/schedules/edit-schedule-dialog";
import { Dialog } from "@/components/ui/dialog";
import { useFilterStore } from "@/stores/filters";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";
import { CalendarDays, Plus, Pencil, Trash2, ListFilter, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function SchedulesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const storeOwnerId = useFilterStore((s) => s.ownerId);
  const setStoreOwnerId = useFilterStore((s) => s.setOwnerId);

  const [selectedOwnerId, setSelectedOwnerId] = useState(storeOwnerId ?? "");
  const ownerId = selectedOwnerId || storeOwnerId || "";

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<TripSchedule | null>(null);
  const [occurrencesSchedule, setOccurrencesSchedule] = useState<TripSchedule | null>(null);
  const [occurrencesTrips, setOccurrencesTrips] = useState<Trip[]>([]);
  const [occurrencesLoading, setOccurrencesLoading] = useState(false);

  const { data: page, isLoading, error } = useApiQuery(
    qk.schedules(ownerId || "none"),
    () => fetchOwnerSchedulesPage(ownerId, null),
    { enabled: Boolean(ownerId) },
  );

  const items = useMemo(() => {
    const list = page?.items ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (s) =>
        s.line.name.toLowerCase().includes(q) ||
        (s.bus.plateNumber && s.bus.plateNumber.toLowerCase().includes(q)) ||
        (s.driver?.name && s.driver.name.toLowerCase().includes(q)),
    );
  }, [page?.items, search]);

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
        void queryClient.invalidateQueries({ queryKey: ["schedules"] });
      }
    },
    [confirm, queryClient],
  );

  const openOccurrences = useCallback(async (schedule: TripSchedule) => {
    setOccurrencesSchedule(schedule);
    setOccurrencesLoading(true);
    const res = await fetchScheduleTrips(schedule.ownerId, schedule.lineId, schedule.id);
    setOccurrencesLoading(false);
    if (res.ok) {
      setOccurrencesTrips(res.data.items);
    } else {
      setOccurrencesTrips([]);
    }
  }, []);

  const columns: CommunityColumnDef<TripSchedule>[] = useMemo(
    () => [
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
        width: 140,
        cellRenderer: (params: { data: TripSchedule }) => (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => openOccurrences(params.data)}
              title={t("schedules.tabs.occurrences")}
            >
              <CalendarDays className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditingSchedule(params.data)}
              title={t("common.actions.edit")}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleDelete(params.data)}
              title={t("common.actions.delete")}
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
          disabled={!ownerId}
        >
          <Plus className="size-4" /> {t("schedules.createButton")}
        </Button>
      </div>

      <div className="rounded-2xl border border-[#dce8ef] bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <OwnerPicker
            ownerId={ownerId}
            onOwnerChange={(next) => {
              setSelectedOwnerId(next);
              setStoreOwnerId(next);
            }}
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("schedules.filter.searchPlaceholder")}
            aria-label={t("schedules.filter.searchPlaceholder")}
            disabled={!ownerId}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error.message || t("common.error.somethingWentWrong")}
        </p>
      ) : null}

      {!ownerId ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-500">
          {t("schedules.pickOwnerNotice")}
        </div>
      ) : isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : (
        <CursorList<TripSchedule>
          gridId="schedules-list"
          initialItems={items}
          initialCursor={page?.nextCursor ?? null}
          loadMore={(cursor) =>
            fetchOwnerSchedulesPage(ownerId, cursor).then((res) => {
              if (!res.ok) throw new Error(res.message);
              return res.data;
            })
          }
          keyOf={(row) => row.id}
          columnDefs={columns}
          emptyMessage={t("schedules.empty")}
          renderItem={(s) => (
            <div className="flex items-center justify-between border-b border-slate-100 p-3">
              <div>
                <p className="font-semibold text-slate-900">{s.line.name}</p>
                <p className="text-xs text-slate-500">
                  {s.departTime} · {s.bus.plateNumber} · {s.driver?.name ?? t("schedules.noDriver")}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => openOccurrences(s)}
                >
                  <CalendarDays className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingSchedule(s)}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
            </div>
          )}
        />
      )}

      {createOpen && (
        <CreateScheduleDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          lockedOwnerId={ownerId || undefined}
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
        <Dialog
          open={Boolean(occurrencesSchedule)}
          onOpenChange={(open) => {
            if (!open) setOccurrencesSchedule(null);
          }}
          title={t("schedules.tabs.occurrences")}
          description={t("schedules.occurrencesNotice")}
          size="lg"
        >
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              <span className="font-bold">{occurrencesSchedule.line.name}</span> ·{" "}
              {occurrencesSchedule.departTime} · {occurrencesSchedule.bus.plateNumber}
            </div>

            {occurrencesLoading ? (
              <p className="text-center text-sm text-slate-500">{t("common.loading.page")}</p>
            ) : occurrencesTrips.length === 0 ? (
              <p className="text-center text-sm text-slate-500">{t("schedules.occurrencesEmpty")}</p>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2">
                {occurrencesTrips.map((trip) => (
                  <div
                    key={trip.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {new Date(trip.departAt).toLocaleDateString("ar-EG", {
                          timeZone: "Africa/Cairo",
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t("schedules.timePrefix")} {new Date(trip.departAt).toLocaleTimeString("ar-EG", {
                          timeZone: "Africa/Cairo",
                          hour: "2-digit",
                          minute: "2-digit",
                        })} · {t("schedules.statusPrefix")} {trip.status}
                      </p>
                    </div>
                    <Link
                      href={`/trips/${trip.id}?ownerId=${occurrencesSchedule.ownerId}&lineId=${occurrencesSchedule.lineId}`}
                      className="text-xs font-bold text-sky-600 hover:underline"
                    >
                      {t("common.actions.openDetails")}
                    </Link>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setOccurrencesSchedule(null)}>
                {t("common.actions.close")}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
