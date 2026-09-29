"use client";

import Link from "next/link";
import { use, useState } from "react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { TableSkeleton } from "@/components/ui/skeletons";
import { RatingCell } from "@/components/owners/rating-cell";
import { DriverAvatar } from "@/components/owners/driver-avatar";
import { useFilterStore } from "@/stores/filters";
import { findTripAcrossLines } from "@/lib/actions/trips";
import {
  fetchTripFeedbackPage,
  type TripFeedbackRow,
} from "@/lib/actions/feedback";
import { t } from "@/lib/i18n/t";

/**
 * Per-trip feedback: every rated booking, with the passenger, the line, the
 * bus, the driver SNAPSHOTTED at departure, and both rating sides side by side.
 * A missing side is an explicit "not rated yet" state, never a zero.
 */
export default function TripFeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = use(params);
  const scopedOwnerId = useFilterStore((s) => s.ownerId);
  const [lineId, setLineId] = useState("");
  const [rows, setRows] = useState<TripFeedbackRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The trip is addressed by (owner, line, trip): resolve the line the first
  // time the page is opened, then page the feedback.
  const [resolving, setResolving] = useState(false);
  if (scopedOwnerId && !lineId && !resolving) {
    setResolving(true);
    void (async () => {
      const found = await findTripAcrossLines(scopedOwnerId, tripId);
      if (!found.ok) {
        setError(found.message);
        return;
      }
      setLineId(found.data.lineId);
    })();
  }

  if (scopedOwnerId && lineId && !loaded) {
    void fetchTripFeedbackPage(scopedOwnerId, lineId, tripId, null).then((result) => {
      if (result.ok) {
        setRows(result.data.items);
        setCursor(result.data.nextCursor);
      } else {
        setError(result.message);
      }
      setLoaded(true);
    });
  }

  const columns: CommunityColumnDef<TripFeedbackRow>[] = [
    { field: "passenger.name", headerName: t("feedback.passenger"), valueGetter: (params) => params.data?.passenger.name },
    { field: "passenger.seats", headerName: t("common.fields.seats"), valueGetter: (params) => params.data?.passenger.seats },
    { field: "trip.line.name", headerName: t("common.fields.tripLine"), valueGetter: (params) => params.data?.trip.line.name },
    { field: "trip.bus.registrationNumber", headerName: t("common.fields.bus"), valueGetter: (params) => params.data?.trip.bus.registrationNumber },
    {
      headerName: t("common.fields.snapshottedDriver"),
      valueGetter: (params) => params.data?.trip.driver?.name || "—",
      cellRenderer: (params: { data: TripFeedbackRow }) =>
        params.data.trip.driver ? (
          <div className="flex items-center gap-2">
            <DriverAvatar name={params.data.trip.driver.name} picture={params.data.trip.driver.picture} size="sm" />
            <span>{params.data.trip.driver.name}</span>
          </div>
        ) : (
          <span>{t("common.value.withoutName")}</span>
        ),
    },
    {
      headerName: t("feedback.driverFeedback"),
      cellRenderer: (params: { data: TripFeedbackRow }) => (
        <div className="flex flex-col">
          <RatingCell value={params.data.driverFeedback.rating} />
          {params.data.driverFeedback.comment ? (
            <span className="text-xs text-[#606060]">{params.data.driverFeedback.comment}</span>
          ) : null}
        </div>
      ),
    },
    {
      headerName: t("feedback.busFeedback"),
      cellRenderer: (params: { data: TripFeedbackRow }) => (
        <div className="flex flex-col">
          <RatingCell value={params.data.busFeedback.rating} />
          {params.data.busFeedback.comment ? (
            <span className="text-xs text-[#606060]">{params.data.busFeedback.comment}</span>
          ) : null}
        </div>
      ),
    },
    {
      field: "driverFeedback.ratedAt",
      headerName: t("feedback.ratedAt"),
      valueGetter: (params) => (params.data?.driverFeedback.ratedAt ?? params.data?.busFeedback.ratedAt)
        ? new Date((params.data?.driverFeedback.ratedAt ?? params.data?.busFeedback.ratedAt) as string).toLocaleString("ar-EG")
        : "—",
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0">
          <h1 className="page-title">{t("feedback.title")}</h1>
          <p className="page-description">{t("feedback.description")}</p>
        </div>
        <Link href="/trips" className="text-sm font-medium text-[#059ff8] underline">
          {t("common.actions.backTo", { value: t("trips.title") })}
        </Link>
      </div>

      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {!scopedOwnerId ? (
        <p className="panel-card p-4 text-sm text-[#606060]">{t("drivers.detail.pickOwnerDescription")}</p>
      ) : !loaded ? (
        <TableSkeleton rows={6} columns={columns.length} />
      ) : (
        <CursorList<TripFeedbackRow>
          gridId={`trip-feedback-${tripId}`}
          initialItems={rows}
          initialCursor={cursor}
          loadMore={async (next) => {
            const result = await fetchTripFeedbackPage(scopedOwnerId, lineId, tripId, next);
            if (!result.ok) throw new Error(result.message);
            return result.data;
          }}
          keyOf={(row) => row.id}
          columnDefs={columns}
          emptyMessage={t("feedback.empty")}
        />
      )}
    </div>
  );
}
