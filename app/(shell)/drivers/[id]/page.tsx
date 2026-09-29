"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
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
import { OwnerPicker } from "@/components/owners/owner-picker";
import { DriverAvatar } from "@/components/owners/driver-avatar";
import { RatingCell } from "@/components/owners/rating-cell";
import { DetailPageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { setOwnerScopeCookie } from "@/lib/owner-scope-cookie";
import { Pencil, Trash2 } from "lucide-react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { fetchDriverTripsPage, type DriverTripRow } from "@/lib/actions/feedback";
import { EditDriverDialog } from "@/components/drivers/edit-driver-dialog";
import { t } from "@/lib/i18n/t";

/**
 * Driver detail. The route id IS the driver user id, which is what every
 * driver sub-resource is keyed by. The KPIs are cross-owner aggregates (a
 * driver's overall quality spans all of their owner assignments); the owner
 * picker only decides WHICH owner's scope the editable roster entry comes from.
 */
export default function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const scopedOwnerId = useFilterStore((s) => s.ownerId);
  const setOwnerId = useFilterStore((s) => s.setOwnerId);
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [status, setStatus] = useState<Member["status"]>("ACTIVE");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [trips, setTrips] = useState<{ items: DriverTripRow[]; nextCursor: string | null } | null>(null);

  const { data: driverData, error: driverError } = useApiQuery<DriverRow>(
    qk.driver(scopedOwnerId ?? "unknown", id),
    () => fetchDriver(scopedOwnerId!, id),
    { enabled: Boolean(scopedOwnerId) },
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

  // One row per trip for the selected owner; the KPI numbers above come from
  // the cross-owner detail payload.
  const [tripsToken, setTripsToken] = useState(0);
  if (scopedOwnerId && tripsToken === 0) {
    setTripsToken(1);
    void fetchDriverTripsPage(scopedOwnerId, id, null).then((result) => {
      if (result.ok) setTrips(result.data);
    });
  }

  async function onSaved(fresh: DriverRow) {
    setDriver(fresh);
    if (fresh.status === "ACTIVE" || fresh.status === "SUSPENDED" || fresh.status === "REVOKED") {
      setStatus(fresh.status);
    }
    if (scopedOwnerId) patchDetail(queryClient, qk.driver(scopedOwnerId, id), fresh);
    setNote(t("common.toast.saved"));
  }

  async function remove() {
    if (!scopedOwnerId) return;
    setError(null);
    setNote(null);
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("drivers.detail.deleteConfirm.description"), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const r = await removeDriver(scopedOwnerId, id);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    router.push("/drivers");
    router.refresh();
  }

  function selectOwner(nextOwnerId: string) {
    setOwnerId(nextOwnerId || null);
    setOwnerScopeCookie(nextOwnerId || null);
    setTripsToken(0);
    setTrips(null);
  }

  if (!scopedOwnerId) {
    return (
      <div className="dashboard-page max-w-xl">
        <div>
          <h1 className="page-title">{t("drivers.detail.manageTitle")}</h1>
          <p className="page-description">{t("drivers.detail.pickOwnerDescription")}</p>
        </div>
        <div className="panel-card p-5 sm:p-6">
          <OwnerPicker ownerId="" onOwnerChange={selectOwner} label={t("drivers.detail.pickOwner")} />
        </div>
      </div>
    );
  }
  if (fetchFailed) return <p role="alert" className="text-sm text-red-600">{fetchFailed}</p>;
  if (!driver) return <DetailPageSkeleton sections={2} />;

  const stats = driver.stats ?? { tripCount: 0, overallRating: null, uniqueBusCount: 0 };

  const tripColumns: CommunityColumnDef<DriverTripRow>[] = [
    { field: "line.name", headerName: t("common.fields.tripLine"), valueGetter: (params) => params.data?.line.name },
    { field: "line.origin", headerName: t("common.fields.origin"), valueGetter: (params) => params.data?.line.origin || "—" },
    { field: "line.destination", headerName: t("common.fields.destination"), valueGetter: (params) => params.data?.line.destination || "—" },
    { field: "bus.registrationNumber", headerName: t("common.fields.bus"), valueGetter: (params) => params.data?.bus.registrationNumber },
    { field: "departAt", headerName: t("common.fields.date"), valueGetter: (params) => (params.data?.departAt ? new Date(params.data.departAt).toLocaleString("ar-EG") : "—") },
    { field: "status", headerName: t("common.fields.status") },
    { field: "passengerCount", headerName: t("common.fields.passengerCount") },
    {
      headerName: t("common.fields.driverRating"),
      cellRenderer: (params: { data: DriverTripRow }) => <RatingCell value={params.data.driverRatingAvg} />,
    },
    {
      headerName: t("common.fields.busRating"),
      cellRenderer: (params: { data: DriverTripRow }) => <RatingCell value={params.data.busRatingAvg} />,
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <DriverAvatar name={driver.name} picture={driver.picture} size="lg" />
          <div className="min-w-0">
            <h1 className="page-title truncate">{driver.name ?? t("common.value.ownerWithoutName")}</h1>
            <p className="page-description">{t("drivers.detail.description")}</p>
          </div>
        </div>
        <AsyncButton type="button" variant="destructive" onClick={remove}><Trash2 className="size-4" /> {t("drivers.detail.deleteDriver")}</AsyncButton>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {note && <p role="status" className="text-sm text-green-700">{note}</p>}

      <section className="panel-card p-5 sm:p-6">
        <div className="max-w-md">
          <OwnerPicker ownerId={scopedOwnerId} onOwnerChange={selectOwner} label={t("drivers.detail.pickOwner")} />
        </div>
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
      </section>

      <section className="space-y-3">
        <h2 className="section-title">{t("drivers.detail.sections.kpis")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiLink href={`/drivers/${id}/trips`} label={t("drivers.kpi.tripCount")} value={String(stats.tripCount)} />
          <KpiLink href={`/drivers/${id}/ratings`} label={t("common.rating.average")} value={stats.overallRating === null ? t("common.rating.unrated") : String(Math.round(stats.overallRating * 10) / 10)} />
          <KpiLink href={`/drivers/${id}/assignments`} label={t("drivers.kpi.uniqueBuses")} value={String(stats.uniqueBusCount)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">{t("drivers.detail.sections.trips")}</h2>
        {tripsToken === 1 && !trips ? (
          <TableSkeleton rows={5} columns={9} />
        ) : (
          <CursorList<DriverTripRow>
            gridId={`driver-trips-${id}`}
            initialItems={trips?.items ?? []}
            initialCursor={trips?.nextCursor ?? null}
            loadMore={async (cursor) => {
              const result = await fetchDriverTripsPage(scopedOwnerId, id, cursor);
              if (!result.ok) throw new Error(result.message);
              return result.data;
            }}
            keyOf={(trip) => trip.id}
            columnDefs={tripColumns}
            emptyMessage={t("trips.empty")}
            renderItem={(trip) => (
              <Link
                href={`/trips/${trip.id}/feedback`}
                className="text-sm font-medium text-[#059ff8] underline"
              >
                {t("common.actions.viewFeedback")}
              </Link>
            )}
          />
        )}
      </section>

      <EditDriverDialog
        open={editOpen}
        driver={driver ? { ...driver, owner: { id: scopedOwnerId } } : null}
        onClose={() => setEditOpen(false)}
        onSaved={(fresh) => void onSaved(fresh)}
      />
    </div>
  );
}

/** Clickable KPI card — the whole card is the link to the matching sub-page. */
function KpiLink({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <Link href={href} className="panel-card block p-4 transition hover:bg-[#f8fbfd]">
      <p className="text-sm text-[#606060]">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </Link>
  );
}
