"use client";

import { useState } from "react";
import { Eye, History, Pencil, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { RowActions } from "@/components/ui/row-actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { TableSkeleton } from "@/components/ui/skeletons";
import { DriverAvatar } from "@/components/owners/driver-avatar";
import { RatingCell } from "@/components/owners/rating-cell";
import {
  fetchSystemDriversPage,
  removeDriver,
  MEMBER_STATUS_AR,
  type DriverRow,
  type SystemDriverRow,
} from "@/lib/actions/members";
import { driverHref } from "@/lib/owner-scope";
import { applyMutationCache, driverImpact } from "@/lib/cache/mutations";
import { qk, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";
import { CreateDriverDialog } from "@/components/drivers/create-driver-dialog";
import { EditDriverDialog } from "@/components/drivers/edit-driver-dialog";
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
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const [driverForEdit, setDriverForEdit] = useState<SystemDriverRow | null>(null);
  const { data: page, isLoading, error } = useApiQuery<DriverPage>(qk.drivers, () => fetchSystemDriversPage(null));
  const drivers = page?.items ?? [];

  async function removeDriverRow(driver: SystemDriverRow) {
    const label = driver.name || driver.nickname || driver.phoneNumber || t("drivers.list.rowLabel");
    if (
      !(await confirm({
        title: t("common.actions.deleteConfirmTitle"),
        description: t("drivers.list.deleteConfirm.description", {
          label,
          value: driver.isIndependent
            ? t("drivers.list.independentOwner")
            : driver.owner?.name ?? "",
        }),
        confirmLabel: t("common.actions.delete"),
        destructive: true,
      }))
    ) {
      return;
    }
    const result = await removeDriver(driver.owner.id, driver.userId ?? driver.id, {
      isIndependent: driver.isIndependent,
      ownerLabel: driver.owner?.name ?? null,
    });
    if (!result.ok) return;
    // One impact declaration for the global roster, the owner roster, the detail
    // slot and the dependent histories — and it runs ONLY on success, so a
    // failed removal can never leave a phantom row behind.
    applyMutationCache(
      queryClient,
      driverImpact({
        driver: {
          id: driver.id,
          ownerId: driver.owner.id,
          userId: driver.userId ?? driver.id,
        },
        mode: "remove",
        // A removed independent driver is REVOKED, not deleted: keep the row in
        // the cached page with its new status so an administrator can review or
        // reactivate it instead of watching it vanish.
        revoked: driver.isIndependent,
      }),
      result,
    );
  }

  // بعد الحفظ من نافذة التعديل — الـ row المحدث يوصل الكاش فورًا من غير رفريش
  function onDriverSaved(fresh: DriverRow) {
    upsertInCursorList<SystemDriverRow>(queryClient, qk.drivers, { ...driverForEdit, ...fresh } as SystemDriverRow);
  }

  const columns: CommunityColumnDef<SystemDriverRow>[] = [
    {
      headerName: t("common.fields.driver"),
      valueGetter: (params) => params.data?.name || t("common.value.withoutName"),
      cellRenderer: (params: { data: SystemDriverRow }) => (
        <div className="flex items-center gap-2">
          <DriverAvatar name={params.data.name} picture={params.data.picture} size="sm" />
          <span>{params.data.name || t("common.value.withoutName")}</span>
        </div>
      ),
    },
    { field: "phoneNumber", headerName: t("common.fields.phone") },
    {
      // A personal membership has no company behind it — showing the driver's
      // own name in the "owner" column would present a solo driver as a fleet
      // owner, which is exactly the confusion this column exists to prevent.
      field: "owner.name",
      headerName: t("common.fields.owner"),
      valueGetter: (params) =>
        params.data?.isIndependent ? t("drivers.list.independentOwner") : params.data?.owner?.name || t("common.value.ownerWithoutName"),
    },
    {
      // Plate number is what the operator recognises.
      field: "assignedBus.plateNumber",
      headerName: t("drivers.columns.assignedBus"),
      valueGetter: (params) =>
        params.data?.assignedBus?.plateNumber ?? t("drivers.list.notAssigned"),
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
            return (
              <RowActions
                label={t("drivers.list.rowActions", { value: driver.name || driver.nickname || driver.phoneNumber || "" })}
                actions={[
                  // Detail links use the DRIVER USER id (stable across membership
                  // churn) and carry THIS row's company, so opening a driver
                  // never lands on an unrelated global owner filter.
                  { label: t("common.actions.openDetails"), icon: Eye, href: driverHref(driverUserId, driver.owner.id) },
                  { label: t("drivers.subPages.trips.title"), icon: History, href: driverHref(driverUserId, driver.owner.id, "/trips") },
                  { label: t("drivers.subPages.assignments.title"), icon: History, href: driverHref(driverUserId, driver.owner.id, "/assignments") },
                  { label: t("drivers.subPages.ratings.title"), icon: Star, href: driverHref(driverUserId, driver.owner.id, "/ratings") },
                  { label: t("common.actions.edit"), icon: Pencil, onSelect: () => setDriverForEdit(driver) },
                  { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void removeDriverRow(driver) },
                ]}
              />
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
    </div>
  );
}
