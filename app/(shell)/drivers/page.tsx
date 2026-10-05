"use client";

import { useDriverActions } from "@/components/drivers/use-driver-actions";
import { useState } from "react";
import { Bus, Eye, History, Pencil, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { RowActions, type RowAction } from "@/components/ui/row-actions";
import { TableSkeleton } from "@/components/ui/skeletons";
import { DriverAvatar } from "@/components/owners/driver-avatar";
import { RatingCell } from "@/components/owners/rating-cell";
import {
  fetchSystemDriversPage,
  MEMBER_STATUS_AR,
  type DriverRow,
  type SystemDriverRow,
} from "@/lib/actions/members";
import { driverHref } from "@/lib/owner-scope";
import { qk, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";
import { CreateDriverDialog } from "@/components/drivers/create-driver-dialog";
import { EditDriverDialog } from "@/components/drivers/edit-driver-dialog";
import { AssignBusDialog, type AssignDriverRef } from "@/components/drivers/assign-bus-dialog";
import { AddBusDialog } from "@/components/drivers/add-bus-dialog";
import { CreateBusDialog } from "@/components/buses/create-bus-dialog";
import { t } from "@/lib/i18n/t";

type DriverPage = { items: SystemDriverRow[]; nextCursor: string | null };

/**
 * Global (cross-owner) driver roster.
 *
 * There is deliberately NO page-level owner selector here: the list spans every
 * company, and filtering it to one would contradict what the screen is for. A
 * row still carries its own `ownerId`, which is what its detail/history links
 * use so opening a driver lands on THAT driver's company instead of a stale
 * global filter.
 */
export default function DriversPage() {
  const queryClient = useQueryClient();
  const driverActions = useDriverActions();
  const [createOpen, setCreateOpen] = useState(false);
  const [driverForEdit, setDriverForEdit] = useState<SystemDriverRow | null>(null);
  const [driverForAssign, setDriverForAssign] = useState<SystemDriverRow | null>(null);
  const [driverForAddBus, setDriverForAddBus] = useState<SystemDriverRow | null>(null);
  const [createBusForDriver, setCreateBusForDriver] = useState<AssignDriverRef | null>(null);
  const { data: page, isLoading, error } = useApiQuery<DriverPage>(qk.drivers, () => fetchSystemDriversPage(null));
  const drivers = page?.items ?? [];

  // The assignment dialogs fix the driver and work in its own company scope.
  function assignRef(driver: SystemDriverRow): AssignDriverRef {
    return {
      userId: driver.userId ?? driver.id,
      ownerId: driver.owner.id,
      name: driver.name ?? driver.nickname ?? driver.phoneNumber,
      ownerName: driver.owner.name,
    };
  }

  // بعد الحفظ من نافذة التعديل — الـ row المحدث يوصل الكاش فورًا من غير رفريش
  function onDriverSaved(fresh: DriverRow, previous = driverForEdit) {
    if (previous) upsertInCursorList<SystemDriverRow>(queryClient, qk.drivers, { ...previous, ...fresh });
  }

  const columns: CommunityColumnDef<SystemDriverRow>[] = [
    {
      headerName: t("common.fields.driver"),
      valueGetter: (params) => params.data?.name || t("common.value.withoutName"),
      cellRenderer: (params: { data: SystemDriverRow }) => (
        <div className="flex items-center gap-2">
          <DriverAvatar name={params.data.name} picture={params.data.picture} size="sm" />
          <span>{params.data.name || t("common.value.withoutName")}</span>
          {params.data.isOwnerDriver ? (
            <span className="shrink-0 rounded-full bg-[#e8f1fb] px-2 py-0.5 text-[0.7rem] font-bold text-[#1f6f8b]">
              {t("drivers.list.ownerDriverBadge")}
            </span>
          ) : null}
        </div>
      ),
    },
    { field: "phoneNumber", headerName: t("common.fields.phone") },
    {
      // Every roster row belongs to one owner scope — the owner's own
      // self-membership included — so this column is always a real owner name.
      field: "owner.name",
      headerName: t("common.fields.owner"),
      valueGetter: (params) => params.data?.owner?.name || t("common.value.ownerWithoutName"),
    },
    {
      // Plate numbers are what the operator recognises; a driver may hold
      // several active assignments, so every plate is listed.
      colId: "assignedBuses",
      headerName: t("drivers.columns.assignedBus"),
      valueGetter: (params) => {
        const buses = params.data?.assignedBuses ?? [];
        const plates = buses
          .map((bus) => bus.plateNumber || bus.registrationNumber)
          .filter((plate): plate is string => Boolean(plate));
        if (plates.length > 0) return plates.join(t("common.listSeparator"));
        return params.data?.assignedBus?.plateNumber ?? t("drivers.list.notAssigned");
      },
    },
    {
      headerName: t("drivers.columns.overallRating"),
      cellRenderer: (params: { data: SystemDriverRow }) => <RatingCell value={params.data.stats?.overallRating ?? null} />,
    },
    {
      field: "status",
      headerName: t("common.fields.status"),
      filter: "agTextColumnFilter",
      valueFormatter: (params) => MEMBER_STATUS_AR[params.value as keyof typeof MEMBER_STATUS_AR] ?? params.value,
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0">
          <h1 className="page-title">{t("drivers.title")}</h1>
          <p className="page-description">{t("drivers.description")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>{t("drivers.newDriver")}</Button>
      </div>

      {error ? <p role="alert" className="text-sm text-red-600">{error.message}</p> : null}
      {isLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : (
        <CursorList<SystemDriverRow>
          gridId="drivers"
          initialItems={drivers}
          initialCursor={page?.nextCursor ?? null}
          loadMore={async (cursor) => {
            const result = await fetchSystemDriversPage(cursor);
            if (!result.ok) throw new Error(result.message);
            return result.data;
          }}
          keyOf={(driver) => driver.id}
          columnDefs={columns}
          emptyMessage={t("drivers.empty")}
          renderItem={(driver) => {
            const driverUserId = driver.userId ?? driver.id;
            // Owner-driver rows get navigation instead of lifecycle actions
            // (the hook returns the manage-in-owners action for them).
            const lifecycleActions = driverActions(driver, driver.owner.id, (fresh) => onDriverSaved(fresh, driver));
            const editAction: RowAction = { label: t("common.actions.edit"), icon: Pencil, onSelect: () => setDriverForEdit(driver) };
            return (
              <div className="flex h-full w-full items-center overflow-x-auto">
                <div className="min-w-max">
                  <RowActions
                    label={t("drivers.list.rowActions", { value: driver.name || driver.nickname || driver.phoneNumber || "" })}
                    actions={[
                      ...(driver.isOwnerDriver ? lifecycleActions : [editAction, ...lifecycleActions]),
                      // Detail links use the DRIVER USER id (stable across membership
                      // churn) and carry THIS row's company, so opening a driver
                      // never lands on an unrelated global owner filter.
                      { label: t("common.actions.openDetails"), icon: Eye, href: driverHref(driverUserId, driver.owner.id) },
                      { label: t("drivers.subPages.trips.title"), icon: History, href: driverHref(driverUserId, driver.owner.id, "/trips") },
                      { label: t("drivers.subPages.assignments.title"), icon: History, href: driverHref(driverUserId, driver.owner.id, "/assignments") },
                      { label: t("drivers.subPages.ratings.title"), icon: Star, href: driverHref(driverUserId, driver.owner.id, "/ratings") },
                      { label: t("drivers.list.assignBus"), icon: Bus, onSelect: () => setDriverForAssign(driver) },
                      { label: t("drivers.list.addBus"), icon: Plus, onSelect: () => setDriverForAddBus(driver) },
                    ]}
                  />
                </div>
              </div>
            );
          }}
        />
      )}
      <CreateDriverDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(driver) =>
          upsertInCursorList<SystemDriverRow>(queryClient, qk.drivers, driver)
        }
      />
      <EditDriverDialog
        open={Boolean(driverForEdit)}
        driver={driverForEdit}
        onClose={() => setDriverForEdit(null)}
        onSaved={onDriverSaved}
      />
      <AssignBusDialog
        open={Boolean(driverForAssign)}
        driver={driverForAssign ? assignRef(driverForAssign) : null}
        onClose={() => setDriverForAssign(null)}
      />
      <AddBusDialog
        open={Boolean(driverForAddBus)}
        driver={driverForAddBus ? assignRef(driverForAddBus) : null}
        onClose={() => setDriverForAddBus(null)}
        onCreateNew={(fixed) => setCreateBusForDriver(fixed)}
      />
      <CreateBusDialog
        open={Boolean(createBusForDriver)}
        fixedDriver={createBusForDriver ? {
          userId: createBusForDriver.userId,
          ownerId: createBusForDriver.ownerId,
          ownerLabel: createBusForDriver.ownerName,
          driverLabel: createBusForDriver.name,
        } : null}
        onClose={() => setCreateBusForDriver(null)}
      />
    </div>
  );
}
