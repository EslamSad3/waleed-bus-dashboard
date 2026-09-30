"use client";

import Link from "next/link";
import { use, useState } from "react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { TableSkeleton } from "@/components/ui/skeletons";
import { RatingCell } from "@/components/owners/rating-cell";
import { driverHref, useDriverOwnerScope } from "@/lib/owner-scope";
import {
  fetchDriverAssignmentsPage,
  fetchDriverRatingRowsPage,
  fetchDriverTripRowsPage,
  ASSIGNMENT_STATUS_AR,
  type DriverAssignmentRow,
} from "@/lib/actions/members";
import { TRIP_STATUS_AR, type Trip } from "@/lib/actions/trips";
import type { DriverRatingRow, DriverTripRow } from "@/lib/actions/feedback";
import { t } from "@/lib/i18n/t";

/**
 * Shared shell for the three driver sub-pages (assignments / trips / ratings).
 * Each one is a complete, cursor-paginated history; the owner scope decides
 * which company's slice is shown, and the numbers stay honest about that scope.
 *
 * The scope comes from `?owner=` (the roster link writes the row's own company)
 * before the saved global filter, and a bare bookmark resolves it from the
 * driver's own roster row — so there is NO company selector on these screens.
 */
function DriverSubPage({
  driverId,
  title,
  description,
  columns,
  emptyMessage,
  load,
}: {
  driverId: string;
  title: string;
  description: string;
  columns: CommunityColumnDef<never>[];
  emptyMessage: string;
  load: (ownerId: string, driverId: string, cursor: string | null) => Promise<{ items: never[]; nextCursor: string | null }>;
}) {
  const { ownerId: scopedOwnerId } = useDriverOwnerScope(driverId);
  const [page, setPage] = useState<{ items: never[]; nextCursor: string | null } | null>(null);
  const [token, setToken] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (scopedOwnerId && token === 0) {
    setToken(1);
    void load(scopedOwnerId, driverId, null).then(
      (result) => setPage(result),
      (err: Error) => setError(err.message),
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          <p className="page-description">{description}</p>
        </div>
        <Link
          href={driverHref(driverId, scopedOwnerId ?? "")}
          className="text-sm font-medium text-[#059ff8] underline"
        >
          {t("common.actions.backTo", { value: t("common.fields.driver") })}
        </Link>
      </div>

      {!scopedOwnerId ? (
        <TableSkeleton rows={6} columns={columns.length} />
      ) : error ? (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      ) : !page ? (
        <TableSkeleton rows={6} columns={columns.length} />
      ) : (
        <CursorList<never>
          gridId={`driver-sub-${title}`}
          // The company's slice is the query scope: a link that changes
          // `?owner=` must discard the pages loaded for the previous one.
          scopeKey={scopedOwnerId}
          initialItems={page.items}
          initialCursor={page.nextCursor}
          loadMore={async (cursor) => load(scopedOwnerId, driverId, cursor)}
          keyOf={(row) => String((row as { id: string }).id)}
          columnDefs={columns}
          emptyMessage={emptyMessage}
        />
      )}
    </div>
  );
}

export function DriverAssignmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const columns: CommunityColumnDef<DriverAssignmentRow>[] = [
    {field:"plateNumber",headerName:t("common.fields.plateNumber"),valueFormatter:(params)=>params.value||"—"},
    { field: "status", headerName: t("common.fields.status"), valueFormatter: (params) => ASSIGNMENT_STATUS_AR[String(params.value)] ?? String(params.value ?? "—") },
    { field: "createdAt", headerName: t("common.fields.createdAt"), valueFormatter: (params) => new Date(params.value).toLocaleDateString("ar-EG") },
    { field: "endedAt", headerName: t("drivers.columns.endedAt"), valueFormatter: (params) => (params.value ? new Date(params.value).toLocaleDateString("ar-EG") : "—") },
  ];
  return (
    <DriverSubPage
      driverId={id}
      title={t("drivers.subPages.assignments.title")}
      description={t("drivers.subPages.assignments.description")}
      columns={columns as unknown as CommunityColumnDef<never>[]}
      emptyMessage={t("drivers.subPages.empty")}
      load={async (ownerId, driverId, cursor) => {
        const result = await fetchDriverAssignmentsPage(ownerId, driverId, cursor);
        if (!result.ok) throw new Error(result.message);
        return result.data as unknown as { items: never[]; nextCursor: string | null };
      }}
    />
  );
}

export function DriverTripsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const columns: CommunityColumnDef<DriverTripRow>[] = [
    { field: "line.name", headerName: t("common.fields.tripLine"), valueGetter: (params) => params.data?.line.name },
    { field: "line.origin", headerName: t("common.fields.origin"), valueGetter: (params) => params.data?.line.origin || "—" },
    { field: "line.destination", headerName: t("common.fields.destination"), valueGetter: (params) => params.data?.line.destination || "—" },
    {field:"bus.plateNumber",headerName:t("common.fields.plateNumber"),valueGetter:(params)=>params.data?.bus.plateNumber||"—"},
    { field: "departAt", headerName: t("common.fields.date"), valueGetter: (params) => new Date(params.data?.departAt ?? 0).toLocaleString("ar-EG") },
    { field: "status", headerName: t("common.fields.status"), valueFormatter: (params) => TRIP_STATUS_AR[params.value as Trip["status"]] ?? String(params.value ?? "—") },
    { field: "passengerCount", headerName: t("common.fields.passengerCount") },
    { headerName: t("common.fields.driverRating"), cellRenderer: (params: { data: DriverTripRow }) => <RatingCell value={params.data.driverRatingAvg} /> },
    { headerName: t("common.fields.busRating"), cellRenderer: (params: { data: DriverTripRow }) => <RatingCell value={params.data.busRatingAvg} /> },
  ];
  return (
    <DriverSubPage
      driverId={id}
      title={t("drivers.subPages.trips.title")}
      description={t("drivers.subPages.trips.description")}
      columns={columns as unknown as CommunityColumnDef<never>[]}
      emptyMessage={t("drivers.subPages.empty")}
      load={async (ownerId, driverId, cursor) => {
        const result = await fetchDriverTripRowsPage(ownerId, driverId, cursor);
        if (!result.ok) throw new Error(result.message);
        return result.data as unknown as { items: never[]; nextCursor: string | null };
      }}
    />
  );
}

export function DriverRatingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const columns: CommunityColumnDef<DriverRatingRow>[] = [
    { field: "passengerName", headerName: t("feedback.passenger") },
    { field: "rating", headerName: t("common.fields.driverRating") },
    { field: "comment", headerName: t("common.fields.feedback"), valueFormatter: (params) => params.value || "—" },
    { field: "trip.line.name", headerName: t("common.fields.tripLine"), valueGetter: (params) => params.data?.trip.line.name },
    { field: "trip.departAt", headerName: t("common.fields.date"), valueGetter: (params) => (params.data?.trip.departAt ? new Date(params.data.trip.departAt).toLocaleString("ar-EG") : "—") },
    { field: "ratedAt", headerName: t("feedback.ratedAt"), valueGetter: (params) => (params.data?.ratedAt ? new Date(params.data.ratedAt).toLocaleString("ar-EG") : "—") },
  ];
  return (
    <DriverSubPage
      driverId={id}
      title={t("drivers.subPages.ratings.title")}
      description={t("drivers.subPages.ratings.description")}
      columns={columns as unknown as CommunityColumnDef<never>[]}
      emptyMessage={t("drivers.subPages.empty")}
      load={async (ownerId, driverId, cursor) => {
        const result = await fetchDriverRatingRowsPage(ownerId, driverId, cursor);
        if (!result.ok) throw new Error(result.message);
        return result.data as unknown as { items: never[]; nextCursor: string | null };
      }}
    />
  );
}
