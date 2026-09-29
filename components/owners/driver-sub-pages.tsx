"use client";

import Link from "next/link";
import { use, useState } from "react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { TableSkeleton } from "@/components/ui/skeletons";
import { OwnerPicker } from "@/components/owners/owner-picker";
import { RatingCell } from "@/components/owners/rating-cell";
import { useFilterStore } from "@/stores/filters";
import {
  fetchDriverAssignmentsPage,
  fetchDriverRatingRowsPage,
  fetchDriverTripRowsPage,
  type DriverAssignmentRow,
} from "@/lib/actions/members";
import type { DriverRatingRow, DriverTripRow } from "@/lib/actions/feedback";
import { t } from "@/lib/i18n/t";

/**
 * Shared shell for the three driver sub-pages (assignments / trips / ratings).
 * Each one is a complete, cursor-paginated history; the owner picker decides
 * which company's slice is shown, and the numbers stay honest about that scope.
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
  const scopedOwnerId = useFilterStore((s) => s.ownerId);
  const setOwnerId = useFilterStore((s) => s.setOwnerId);
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
          href={`/drivers/${driverId}`}
          className="text-sm font-medium text-[#059ff8] underline"
        >
          {t("common.actions.backTo", { value: t("common.fields.driver") })}
        </Link>
      </div>

      <div className="max-w-md">
        <OwnerPicker ownerId={scopedOwnerId ?? ""} onOwnerChange={(id) => { setOwnerId(id || null); setToken(0); setPage(null); }} />
      </div>

      {!scopedOwnerId ? (
        <p className="panel-card p-4 text-sm text-[#606060]">{t("drivers.detail.pickOwnerDescription")}</p>
      ) : error ? (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      ) : !page ? (
        <TableSkeleton rows={6} columns={columns.length} />
      ) : (
        <CursorList<never>
          gridId={`driver-sub-${title}`}
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
    { field: "registrationNumber", headerName: t("common.fields.registrationNumber") },
    { field: "plateNumber", headerName: t("common.fields.plateNumber"), valueFormatter: (params) => params.value || "—" },
    { field: "status", headerName: t("common.fields.status") },
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
    { field: "bus.registrationNumber", headerName: t("common.fields.bus"), valueGetter: (params) => params.data?.bus.registrationNumber },
    { field: "departAt", headerName: t("common.fields.date"), valueGetter: (params) => new Date(params.data?.departAt ?? 0).toLocaleString("ar-EG") },
    { field: "status", headerName: t("common.fields.status") },
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
