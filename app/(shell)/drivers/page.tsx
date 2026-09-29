"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ui/image-picker";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { RowActions } from "@/components/ui/row-actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { TableSkeleton } from "@/components/ui/skeletons";
import { OwnerPicker } from "@/components/owners/owner-picker";
import { DriverAvatar } from "@/components/owners/driver-avatar";
import { RatingCell } from "@/components/owners/rating-cell";
import {
  fetchSystemDriversPage,
  inviteDriver,
  removeDriver,
  MEMBER_STATUS_AR,
  type DriverRow,
  type SystemDriverRow,
} from "@/lib/actions/members";
import { discardUserPicture, stageUserPicture } from "@/lib/actions/users";
import type { StagedUpload } from "@/lib/actions/http";
import { driverFreshSchema } from "@/lib/schemas/p1";
import { qk, removeFromCursorList, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";
import { CreateDriverDialog } from "@/components/drivers/create-driver-dialog";
import { EditDriverDialog } from "@/components/drivers/edit-driver-dialog";
import { t } from "@/lib/i18n/t";

type DriverPage = { items: SystemDriverRow[]; nextCursor: string | null };

export default function DriversPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const [driverForEdit, setDriverForEdit] = useState<SystemDriverRow | null>(null);
  const { data: page, isLoading, error } = useApiQuery<DriverPage>(qk.drivers, () => fetchSystemDriversPage(null));
  const drivers = page?.items ?? [];

  async function removeDriverRow(driver: SystemDriverRow) {
    const label = driver.name || driver.nickname || driver.phoneNumber || t("drivers.list.rowLabel");
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("drivers.list.deleteConfirm.description", { label: label, value: driver.owner?.name ?? "" }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await removeDriver(driver.owner.id, driver.userId ?? driver.id);
    if (!result.ok) return;
    removeFromCursorList<SystemDriverRow>(queryClient, qk.drivers, driver.id);
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
    { field: "owner.name", headerName: t("common.fields.owner"), valueGetter: (params) => params.data?.owner?.name || t("common.value.ownerWithoutName") },
    { field: "assignedBus.registrationNumber", headerName: t("drivers.columns.assignedBus"), valueGetter: (params) => params.data?.assignedBus?.registrationNumber || t("drivers.list.notAssigned") },
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
          renderItem={(driver) => (
            <RowActions
              label={t("drivers.list.rowActions", { value: driver.name || driver.nickname || driver.phoneNumber || "" })}
              actions={[
                // Detail links use the DRIVER USER id, which is stable across
                // membership churn and keys every driver sub-resource.
                { label: t("common.actions.openDetails"), icon: Eye, href: `/drivers/${driver.userId ?? driver.id}` },
                { label: t("common.actions.edit"), icon: Pencil, onSelect: () => setDriverForEdit(driver) },
                { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void removeDriverRow(driver) },
              ]}
            />
          )}
        />
      )}
      <CreateDriverDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditDriverDialog
        open={Boolean(driverForEdit)}
        driver={driverForEdit}
        onClose={() => setDriverForEdit(null)}
        onSaved={onDriverSaved}
      />
    </div>
  );
}
