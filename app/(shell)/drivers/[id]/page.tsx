"use client";

import { use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import {
  fetchDriver,
  removeDriver,
  MEMBER_STATUS_AR,
  type DriverRow,
  type Member,
} from "@/lib/actions/members";
import { useFilterStore } from "@/stores/filters";
import { qk, patchDetail, useApiQuery, useQueryClient } from "@/lib/queries";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { FleetPicker } from "@/components/fleet-picker";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
import { setFleetScopeCookie } from "@/lib/fleet-scope-cookie";
import { Pencil, Trash2 } from "lucide-react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { EditDriverDialog } from "@/components/drivers/edit-driver-dialog";
import { t } from "@/lib/i18n/t";

type DriverAssignment = NonNullable<DriverRow["assignments"]>[number];

export default function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const scopedFleetId = useFilterStore((s) => s.fleetId);
  const fleetId = searchParams.get("fleetId") || scopedFleetId;
  const setFleetId = useFilterStore((s) => s.setFleetId);
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [status, setStatus] = useState<Member["status"]>("ACTIVE");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // TanStack cache: the driver detail is fetched through the query layer and
  // mutations patch the same cache slot — the view stays live after dialogs.
  const { data: driverData, error: driverError } = useApiQuery<DriverRow>(
    qk.driver(fleetId ?? "unknown", id),
    () => fetchDriver(fleetId!, id),
    { enabled: Boolean(fleetId) },
  );
  const fetchFailed = driverError?.message ?? null;
  const [seenDriver, setSeenDriver] = useState<DriverRow | null>(null);
  if (driverData && driverData !== seenDriver) {
    setSeenDriver(driverData);
    setDriver(driverData);
    if (driverData.status === "ACTIVE" || driverData.status === "SUSPENDED" || driverData.status === "REVOKED") {
      setStatus(driverData.status);
    }
  }

  async function onSaved(fresh: DriverRow) {
    setDriver(fresh);
    if (fresh.status === "ACTIVE" || fresh.status === "SUSPENDED" || fresh.status === "REVOKED") {
      setStatus(fresh.status);
    }
    if (fleetId) patchDetail(queryClient, qk.driver(fleetId, id), fresh);
    setNote(t("common.toast.saved"));
  }

  async function remove() {
    if (!fleetId) return;
    setError(null);
    setNote(null);
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("drivers.detail.deleteConfirm.description"), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const r = await removeDriver(fleetId, id);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    router.push("/drivers");
    router.refresh();
  }

  function selectFleet(nextFleetId: string) {
    setFleetId(nextFleetId || null);
    setFleetScopeCookie(nextFleetId || null);
  }

  if (!fleetId) {
    return (
      <div className="dashboard-page max-w-xl">
        <div>
          <h1 className="page-title">{t("drivers.detail.manageTitle")}</h1>
          <p className="page-description">{t("drivers.detail.pickFleetDescription")}</p>
        </div>
        <div className="panel-card p-5 sm:p-6">
          <FleetPicker value="" onChange={selectFleet} label={t("drivers.detail.pickFleet")} />
        </div>
      </div>
    );
  }
  if (failed || fetchFailed) return <p role="alert" className="text-sm text-red-600">{failed ?? fetchFailed}</p>;
  if (!driver) return <DetailPageSkeleton sections={2} />;

  const assignmentColumns: CommunityColumnDef<DriverAssignment>[] = [
    { field: "plateNumber", headerName: t("common.fields.plateNumber"), filter: "agTextColumnFilter", valueFormatter: (params) => params.value || "—" },
    { field: "status", headerName: t("common.fields.status"), filter: "agTextColumnFilter" },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0"><h1 className="page-title">{driver.name ?? t("common.fields.driver")}</h1><p className="page-description">{t("drivers.detail.description")}</p></div>
        <AsyncButton type="button" variant="destructive" onClick={remove}><Trash2 className="size-4" /> {t("drivers.detail.deleteDriver")}</AsyncButton>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {note && <p role="status" className="text-sm text-green-700">{note}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel-card p-5 sm:p-6">
          <h2 className="section-title">{t("drivers.detail.sections.membership")}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex min-w-0 items-center justify-between gap-3"><dt className="shrink-0 text-[#606060]">{t("common.fields.nickname")}</dt><dd className="min-w-0 truncate">{driver.nickname ?? "—"}</dd></div>
            <div className="flex min-w-0 items-center justify-between gap-3"><dt className="shrink-0 text-[#606060]">{t("common.fields.phone")}</dt><dd className="min-w-0 truncate" dir="ltr">{driver.phoneNumber ?? "—"}</dd></div>
            <div className="flex min-w-0 items-center justify-between gap-3"><dt className="shrink-0 text-[#606060]">{t("drivers.detail.fields.nationalId")}</dt><dd className="min-w-0 truncate" dir="ltr">{driver.nationalId ?? "—"}</dd></div>
            <div className="flex min-w-0 items-center justify-between gap-3"><dt className="shrink-0 text-[#606060]">{t("common.fields.role")}</dt><dd className="min-w-0 truncate" dir="ltr">{driver.roleSlug ?? "—"}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <span className={status === "ACTIVE" ? "status-pill" : "status-pill status-pill-muted"}>{MEMBER_STATUS_AR[status]}</span>
            <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" aria-hidden="true" /> {t("common.actions.edit")}
            </Button>
          </div>
        </div>
        <div className="panel-card p-5 sm:p-6">
          <h2 className="section-title">{t("drivers.detail.sections.assignments")}</h2>
          <CursorList<DriverAssignment>
            gridId={`driver-assignments-${driver.id}`}
            initialItems={driver.assignments ?? []}
            initialCursor={null}
            loadMore={async () => ({ items: [], nextCursor: null })}
            keyOf={(assignment) => assignment.id}
            columnDefs={assignmentColumns}
            withActions={false}
            emptyMessage={t("drivers.detail.assignmentsEmpty")}
          />
        </div>
      </div>

      <EditDriverDialog
        open={editOpen}
        driver={driver && fleetId ? { ...driver, fleet: { id: fleetId } } : null}
        onClose={() => setEditOpen(false)}
        onSaved={(fresh) => void onSaved(fresh)}
      />
    </div>
  );
}
