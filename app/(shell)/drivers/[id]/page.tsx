"use client";

import { useDriverActions } from "@/components/drivers/use-driver-actions";
import { RowActions } from "@/components/ui/row-actions";
import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  fetchDriver,
  MEMBER_STATUS_AR,
  type DriverRow,
  type Member,
} from "@/lib/actions/members";
import { driverHref, useDriverOwnerScope } from "@/lib/owner-scope";
import { qk, patchDetail, useApiQuery, useQueryClient } from "@/lib/queries";
import { DriverAvatar } from "@/components/owners/driver-avatar";
import { RatingCell } from "@/components/owners/rating-cell";
import { DetailPageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { Pencil } from "lucide-react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { fetchDriverTripsPage, type DriverTripRow } from "@/lib/actions/feedback";
import { TRIP_STATUS_AR, type Trip } from "@/lib/actions/trips";
import { EditDriverDialog } from "@/components/drivers/edit-driver-dialog";
import { t } from "@/lib/i18n/t";

/**
 * Driver detail. The route id IS the driver user id, which is what every
 * driver sub-resource is keyed by. The KPIs are cross-owner aggregates (a
 * driver's overall quality spans all of their owner assignments).
 *
 * There is NO company selector here: the company's editable roster entry comes
 * from the link that got the operator here (`?owner=<id>`, written by the
 * roster), and a bare bookmark resolves the driver's own company from the
 * cross-owner roster. Asking the operator to pick a company to see the driver
 * they just clicked was pure friction.
 */
export default function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const driverActions = useDriverActions();
  const queryClient = useQueryClient();
  const { ownerId: scopedOwnerId, isExplicit } = useDriverOwnerScope(id);
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [status, setStatus] = useState<Member["status"]>("ACTIVE");
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

  // One row per trip for the selected company; the KPI numbers above come from
  // the cross-owner detail payload. A FAILED read is surfaced: an empty grid and
  // a server that could not answer look identical otherwise, and the operator is
  // left believing the driver has no trips.
  const [tripsToken, setTripsToken] = useState(0);
  const [tripsError, setTripsError] = useState<string | null>(null);
  if (scopedOwnerId && tripsToken === 0) {
    setTripsToken(1);
    void fetchDriverTripsPage(scopedOwnerId, id, null).then((result) => {
      if (result.ok) setTrips(result.data);
      else setTripsError(result.message);
    });
  }

  async function onSaved(fresh: DriverRow) {
    const updated = { ...driver, ...fresh };
    setDriver(updated);
    if (fresh.status === "ACTIVE" || fresh.status === "SUSPENDED" || fresh.status === "REVOKED") {
      setStatus(fresh.status);
    }
    if (scopedOwnerId) patchDetail(queryClient, qk.driver(scopedOwnerId, id), updated);
  }

  // The company comes from the link, or — for a bare bookmark — from the
  // driver's own roster row. Until it is known there is no roster entry to
  // edit, so show the skeleton rather than half a driver.
  if (!scopedOwnerId) return <DetailPageSkeleton sections={2} />;
  if (fetchFailed) return <p role="alert" className="text-sm text-red-600">{fetchFailed}</p>;
  if (!driver) return <DetailPageSkeleton sections={2} />;

  const stats = driver.stats ?? { tripCount: 0, overallRating: null, uniqueBusCount: 0 };

  const tripColumns: CommunityColumnDef<DriverTripRow>[] = [
    { field: "line.name", headerName: t("common.fields.tripLine"), valueGetter: (params) => params.data?.line.name },
    { field: "line.origin", headerName: t("common.fields.origin"), valueGetter: (params) => params.data?.line.origin || "—" },
    { field: "line.destination", headerName: t("common.fields.destination"), valueGetter: (params) => params.data?.line.destination || "—" },
    { field: "bus.plateNumber", headerName: t("common.fields.bus"), valueGetter: (params) => params.data?.bus.plateNumber ?? "—" },
    { field: "departAt", headerName: t("common.fields.date"), valueGetter: (params) => (params.data?.departAt ? new Date(params.data.departAt).toLocaleString("ar-EG") : "—") },
    { field: "status", headerName: t("common.fields.status"), valueFormatter: (params) => TRIP_STATUS_AR[params.value as Trip["status"]] ?? String(params.value ?? "—") },
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
            {driver.isOwnerDriver ? (
              <span className="mt-1 inline-block rounded-full bg-[#e8f1fb] px-2 py-0.5 text-[0.7rem] font-bold text-[#1f6f8b]">
                {t("drivers.list.ownerDriverBadge")}
              </span>
            ) : null}
          </div>
        </div>
        <RowActions actions={driverActions(driver, scopedOwnerId, (fresh) => { void onSaved(fresh); }, () => { router.push("/drivers"); router.refresh(); })} />
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {status === "REVOKED" ? (
        <p className="panel-card p-4 text-sm text-[#606060]">{t("drivers.detail.revokeNotice")}</p>
      ) : null}

      <section className="panel-card p-5 sm:p-6">
        <dl className="space-y-2 text-sm">
          <div className="flex min-w-0 items-center justify-between gap-3"><dt className="shrink-0 text-[#606060]">{t("common.fields.nickname")}</dt><dd className="min-w-0 truncate">{driver.nickname ?? "—"}</dd></div>
          <div className="flex min-w-0 items-center justify-between gap-3"><dt className="shrink-0 text-[#606060]">{t("common.fields.phone")}</dt><dd className="min-w-0 truncate" dir="ltr">{driver.phoneNumber ?? "—"}</dd></div>
          <div className="flex min-w-0 items-center justify-between gap-3"><dt className="shrink-0 text-[#606060]">{t("drivers.detail.fields.nationalId")}</dt><dd className="min-w-0 truncate" dir="ltr">{driver.nationalId ?? "—"}</dd></div>
          <div className="flex min-w-0 items-center justify-between gap-3"><dt className="shrink-0 text-[#606060]">{t("common.fields.role")}</dt><dd className="min-w-0 truncate" dir="ltr">{driver.roleSlug ?? "—"}</dd></div>
        </dl>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <span className={status === "ACTIVE" ? "status-pill" : "status-pill status-pill-muted"}>{MEMBER_STATUS_AR[status]}</span>
          {driver.isOwnerDriver ? (
            // The shared owner+driver account is edited from owner
            // administration; the API rejects driver-side mutations here.
            <span className="text-sm text-[#606060]">{t("drivers.detail.ownerManagedNote")}</span>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" aria-hidden="true" /> {t("common.actions.edit")}
            </Button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">{t("drivers.detail.sections.kpis")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiLink href={driverHref(id, scopedOwnerId, "/trips")} label={t("drivers.kpi.tripCount")} value={String(stats.tripCount)} />
          <KpiLink href={driverHref(id, scopedOwnerId, "/ratings")} label={t("common.rating.average")} value={stats.overallRating === null ? t("common.rating.unrated") : String(Math.round(stats.overallRating * 10) / 10)} />
          <KpiLink href={driverHref(id, scopedOwnerId, "/assignments")} label={t("drivers.kpi.uniqueBuses")} value={String(stats.uniqueBusCount)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">{t("drivers.detail.sections.trips")}</h2>
        {tripsError ? (
          <p role="alert" className="panel-card p-4 text-sm text-red-600">
            {tripsError}
          </p>
        ) : tripsToken === 1 && !trips ? (
          <TableSkeleton rows={5} columns={9} />
        ) : (
          <CursorList<DriverTripRow>
            gridId={`driver-trips-${id}`}
            scopeKey={scopedOwnerId}
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
