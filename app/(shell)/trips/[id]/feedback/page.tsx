"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { TableSkeleton } from "@/components/ui/skeletons";
import { RatingCell } from "@/components/owners/rating-cell";
import { DriverAvatar } from "@/components/owners/driver-avatar";
import { useFilterStore } from "@/stores/filters";
import { findTripAcrossLines, findTripAcrossOwners } from "@/lib/actions/trips";
import { findOwnerByLineId } from "@/lib/actions/trip-lines";
import {
  fetchTripFeedbackPage,
  type TripFeedbackRow,
} from "@/lib/actions/feedback";
import { t } from "@/lib/i18n/t";

/**
 * Per-trip feedback: every rated booking, with the passenger, the line, the
 * bus, the driver SNAPSHOTTED at departure, and both rating sides side by side.
 * A missing side is an explicit "not rated yet" state, never a zero.
 *
 * Scope comes from the LINK (`?ownerId=&lineId=`, written by every surface
 * that knows the trip's own company), then the saved company filter, then —
 * for a bare id with neither — the cross-owner trip index. The page never
 * asks for a company the operator did not come here to choose.
 */
export default function TripFeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ownerId?: string; lineId?: string }>;
}) {
  const { id: tripId } = use(params);
  const { ownerId: rawOwnerId, lineId: rawLineId } = use(searchParams);
  const linkOwnerId = (rawOwnerId && rawOwnerId !== "undefined" && rawOwnerId !== "null") ? rawOwnerId : null;
  const linkLineId = (rawLineId && rawLineId !== "undefined" && rawLineId !== "null") ? rawLineId : null;
  const storeOwnerId = useFilterStore((s) => s.ownerId);
  // Scope the link did not carry is resolved once per trip below; the link
  // itself stays authoritative so opening another trip re-scopes.
  const [resolution, setResolution] = useState<{ tripId: string; ownerId: string | null; lineId: string | null }>({
    tripId,
    ownerId: null,
    lineId: null,
  });
  const [rows, setRows] = useState<TripFeedbackRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Render-phase reset from the resolved cache (no setState-in-effect): a new
  // trip, a new link, or a changed company filter is a new result set.
  const [seenScope, setSeenScope] = useState<string | null>(null);
  const scopeSig = `${tripId}|${linkOwnerId ?? ""}|${linkLineId ?? ""}|${storeOwnerId ?? ""}`;
  if (seenScope !== scopeSig) {
    setSeenScope(scopeSig);
    setResolution({ tripId, ownerId: null, lineId: null });
    setRows([]);
    setCursor(null);
    setLoaded(false);
    setError(null);
  }

  const ownerId = linkOwnerId ?? storeOwnerId ?? resolution.ownerId;
  const lineId = linkLineId ?? resolution.lineId ?? "";

  // Resolve whatever scope the link did not carry (callbacks only — no
  // synchronous setState in the effect body).
  useEffect(() => {
    if (lineId && ownerId) return;
    let cancelled = false;
    if (!ownerId) {
      if (lineId) {
        void findOwnerByLineId(lineId).then((foundOwner) => {
          if (cancelled) return;
          if (foundOwner) {
            setResolution({ tripId, ownerId: foundOwner, lineId });
            return;
          }
          void findTripAcrossOwners(tripId).then((found) => {
            if (cancelled) return;
            if (!found.ok) {
              setError(found.message);
              setLoaded(true);
              return;
            }
            setResolution({ tripId, ownerId: found.data.ownerId, lineId: found.data.lineId });
          });
        });
        return () => {
          cancelled = true;
        };
      }
      void findTripAcrossOwners(tripId).then((found) => {
        if (cancelled) return;
        if (!found.ok) {
          setError(found.message);
          setLoaded(true);
          return;
        }
        setResolution({ tripId, ownerId: found.data.ownerId, lineId: found.data.lineId });
      });
      return () => {
        cancelled = true;
      };
    }
    void findTripAcrossLines(ownerId, tripId).then((found) => {
      if (cancelled) return;
      if (!found.ok) {
        setError(found.message);
        setLoaded(true);
        return;
      }
      setResolution({ tripId, ownerId, lineId: found.data.lineId });
    });
    return () => {
      cancelled = true;
    };
  }, [tripId, ownerId, lineId]);

  useEffect(() => {
    if (!ownerId || !lineId || loaded) return;
    let cancelled = false;
    void fetchTripFeedbackPage(ownerId, lineId, tripId, null).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setRows(result.data.items);
        setCursor(result.data.nextCursor);
      } else {
        setError(result.message);
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerId, lineId, tripId, loaded]);

  const columns: CommunityColumnDef<TripFeedbackRow>[] = [
    { field: "passenger.name", headerName: t("feedback.passenger"), valueGetter: (params) => params.data?.passenger.name },
    { field: "passenger.seats", headerName: t("common.fields.seats"), valueGetter: (params) => params.data?.passenger.seats },
    { field: "trip.line.name", headerName: t("common.fields.tripLine"), valueGetter: (params) => params.data?.trip.line.name },
    { field: "trip.bus.plateNumber", headerName: t("common.fields.bus"), valueGetter: (params) => params.data?.trip.bus.plateNumber ?? "—" },
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

  const detailHref =
    ownerId && lineId
      ? `/trips/${tripId}?ownerId=${encodeURIComponent(ownerId)}&lineId=${encodeURIComponent(lineId)}`
      : ownerId
        ? `/trips/${tripId}?ownerId=${encodeURIComponent(ownerId)}`
        : `/trips/${tripId}`;

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0">
          <h1 className="page-title">{t("feedback.title")}</h1>
          <p className="page-description">{t("feedback.description")}</p>
        </div>
        <Link href={detailHref} className="text-sm font-medium text-[#059ff8] underline">
          {t("common.actions.backTo", { value: t("trips.detail.fallbackTitle") })}
        </Link>
      </div>

      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {!ownerId ? (
        <p className="panel-card p-4 text-sm text-[#606060]">{t("trips.detail.pickOwnerDescription")}</p>
      ) : !loaded ? (
        <TableSkeleton rows={6} columns={columns.length} />
      ) : (
        <CursorList<TripFeedbackRow>
          gridId={`trip-feedback-${tripId}`}
          // The feedback belongs to one (owner, line, trip); a different scope
          // means the loaded pages are a different result set.
          scopeKey={ownerId && lineId ? `${ownerId}:${lineId}` : null}
          initialItems={rows}
          initialCursor={cursor}
          loadMore={async (next) => {
            const result = await fetchTripFeedbackPage(ownerId, lineId, tripId, next);
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
