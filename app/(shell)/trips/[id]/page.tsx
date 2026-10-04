"use client";

import { Select } from "@/components/ui/select";

import * as schemas from "@/lib/schemas/p1";

import { schemaErrors } from "@/lib/field-validation";

import { useFieldValidation, ValidationScope } from "@/components/ui/field-validation";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import {
  deleteTrip,
  findTripAcrossLines,
  updateTrip,
  TRIP_STATUS_AR,
  type Trip,
} from "@/lib/actions/trips";
import { assignDriver as assignBusDriver, fetchBus, unassignDriver as unassignBusDriver, type Bus } from "@/lib/actions/buses";
import { apiGet, type ActionResult } from "@/lib/actions/http";
import type { DriverRow } from "@/lib/actions/members";
import { DriverAvatar } from "@/components/owners/driver-avatar";
import { RatingCell } from "@/components/owners/rating-cell";
import { fetchTripFeedbackPage, type TripFeedbackRow } from "@/lib/actions/feedback";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { applyMutationCache, tripImpact } from "@/lib/cache/mutations";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DetailPageSkeleton, InlineBlockSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { Trash2 } from "lucide-react";
import { t } from "@/lib/i18n/t";

/**
 * Trip detail. The line owns the route, so origin/destination are read-only
 * derived values here; a deep link resolves its line first, because trips are
 * addressed by (owner, line, trip).
 */
export default function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ownerId?: string; lineId?: string }>;
}) {
  const { id } = use(params);
  const { ownerId: scopeOwnerId, lineId: scopeLineId } = use(searchParams);
  const router = useRouter();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [ownerId, setOwnerId] = useState(scopeOwnerId ?? "");
  const [lineId, setLineId] = useState(scopeLineId ?? "");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bus, setBus] = useState<Bus | null>(null);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [driverId, setDriverId] = useState("");
  const [busRatingAvg, setBusRatingAvg] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ items: TripFeedbackRow[]; nextCursor: string | null } | null>(null);
  const [feedbackReloadKey, setFeedbackReloadKey] = useState(0);
  const [departAt, setDepartAt] = useState("");
  const [fare, setFare] = useState("");
  const [status, setStatus] = useState<Trip["status"]>("SCHEDULED");

  // A deep link may carry the line; otherwise resolve it from the owner.
  const { error: foundError } = useApiQuery(
    qk.trip(scopeOwnerId ?? "none", scopeLineId ?? "find", id),
    () => findTripAcrossLines(scopeOwnerId!, id),
    { enabled: Boolean(scopeOwnerId && !scopeLineId) },
  );

  const { data: tripData } = useApiQuery(
    qk.trip(ownerId, lineId, id),
    () => apiGet<Trip>(`/api/fleet-owners/${ownerId}/trip-lines/${lineId}/trips/${id}`),
    { enabled: Boolean(ownerId && lineId) },
  );

  // Render-phase sync from the query cache (no setState-in-effect)
  const [seenTrip, setSeenTrip] = useState<Trip | null>(null);
  if (tripData && tripData !== seenTrip) {
    setSeenTrip(tripData);
    setTrip(tripData);
    setDepartAt(tripData.departAt.slice(0, 16));
    setFare(tripData.fare ?? "");
    setStatus(tripData.status);
  }

  useEffect(() => {
    if (!ownerId || lineId) return;
    void findTripAcrossLines(ownerId, id).then((result) => {
      if (!result.ok) return;
      setLineId(result.data.lineId);
    });
  }, [ownerId, id, lineId]);

  // Roster reload for the bus-assignment actions below: the "current bus
  // driver" block derives from `drivers`, so it refreshes itself once the
  // roster is re-read.
  async function refreshDrivers() {
    if (!ownerId) return;
    const refreshed = await apiGet<{ items: DriverRow[] }>(`/api/fleet-owners/${ownerId}/drivers?limit=100`);
    if (refreshed.ok) setDrivers(refreshed.data.items.filter((driver) => driver.status === "ACTIVE"));
  }

  useEffect(() => {
    if (!ownerId || !trip) return;
    fetchBus(ownerId, trip.busId).then((result) => {
      if (result.ok) setBus(result.data);
    });
    apiGet<{ items: DriverRow[] }>(`/api/fleet-owners/${ownerId}/drivers?limit=100`).then((result) => {
      if (result.ok) setDrivers(result.data.items.filter((driver) => driver.status === "ACTIVE"));
    });
  }, [ownerId, trip]);

  useEffect(() => {
    if (!ownerId || !lineId) return;
    fetchTripFeedbackPage(ownerId, lineId, id, null).then((result) => {
      if (!result.ok) return;
      const rated = result.data.items
        .map((row) => row.busFeedback.rating)
        .filter((value): value is number => value !== null);
      setBusRatingAvg(rated.length ? rated.reduce((sum, value) => sum + value, 0) / rated.length : null);
    });
  }, [ownerId, lineId, id]);

  /**
   * Writes a successful trip mutation into the cache BEFORE navigating away.
   *
   * This is the bug the whole feature is about: `router.refresh()` re-renders
   * the server tree but never touches TanStack's client cache, so returning to
   * `/trips` re-rendered the STALE list — a saved fare, a cancelled status, or a
   * deleted trip simply did not appear until something else invalidated the
   * key by luck.
   *
   * The scope comes from the trip's OWN `ownerId`, never from a global owner
   * filter that may have been changed while the operator was on this page.
   */
  function syncTrip(
    result: ActionResult<unknown>,
    mode: "insert" | "update" | "remove",
    subject: Pick<Trip, "id" | "ownerId" | "lineId">,
  ) {
    if (!result.ok) return;
    applyMutationCache(queryClient, tripImpact({ trip: subject, mode }), result);
  }

  /**
   * Page-level outcome: the persistent ERROR alert beside the controls. The
   * success is left to the action wrapper's toast, so one save produces exactly
   * one notice, and the cache is reconciled before any navigation.
   */
  function done(ok: boolean, msg: string, updated?: Trip) {
    setError(ok ? null : msg);
    if (ok && updated) {
      setTrip(updated);
      syncTrip({ ok: true, data: updated }, "update", updated);
    }
  }

  const validation = useFieldValidation(() => schemaErrors(schemas.updateTripSchema, { departAt, fare: fare.trim() || undefined }));

  const driverValidation = useFieldValidation(() => schemaErrors(schemas.assignDriverSchema, { driverUserId: driverId }));

  async function save() {
    if (!validation.validate()) return;
    if (!ownerId || !lineId) return;
    const r = await updateTrip(ownerId, lineId, id, {
      departAt: departAt ? new Date(departAt).toISOString() : undefined,
      fare: fare.trim() || undefined,
    });
    if (!r.ok) { setError(validation.failure(r)); return; }
    done(true, t("common.toast.saved"), r.data);
  }

  async function move(next: Trip["status"]) {
    if (!ownerId || !lineId) return;
    const r = await updateTrip(ownerId, lineId, id, { status: next });
    if (r.ok) setStatus(r.data.status);
    done(r.ok, r.ok ? t("common.toast.saved") : r.message, r.ok ? r.data : undefined);
  }

  async function cancel() {
    if (!(await confirm({ title: t("trips.detail.cancelConfirm.title"), description: t("trips.detail.cancelConfirm.description"), confirmLabel: t("trips.detail.cancelConfirm.confirmLabel"), destructive: true }))) return;
    await move("CANCELLED");
  }

  async function remove() {
    if (!ownerId || !lineId || !trip) return;
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("trips.detail.deleteConfirm.description"), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const r = await deleteTrip(ownerId, lineId, id);
    if (!r.ok) {
      done(false, r.message);
      return;
    }
    // Remove the row from every list BEFORE navigating, so the trip is already
    // gone from `/trips` by the time the operator gets there.
    syncTrip(r, "remove", trip);
    router.push("/trips");
    router.refresh();
  }

  async function assignTripDriver() {
    if (!driverValidation.validate()) return;
    if (!ownerId || !trip) return;
    // This is the TRIP's driver, not the bus's: the API takes it on the trip
    // and freezes it once the trip departs. Re-read the trip afterwards so the
    // block below shows the new driver instead of the stale one.
    const result = await updateTrip(ownerId, lineId, id, { driverUserId: driverId });
    if (!result.ok) { setError(driverValidation.failure(result)); return; }
    done(true, t("trips.detail.toast.driverAssigned"));
    if (result.ok) {
      setTrip(result.data);
      setDriverId("");
      syncTrip(result, "update", result.data);
    }
  }

  async function unassignTripDriver() {
    if (!ownerId || !lineId || !trip?.driverUserId) return;
    const result = await updateTrip(ownerId, lineId, id, { driverUserId: null });
    done(result.ok, result.ok ? t("trips.detail.toast.driverUnassigned") : result.message);
    if (result.ok) {
      setTrip(result.data);
      setDriverId("");
      syncTrip(result, "update", result.data);
    }
  }

  /**
   * Bus-driver assignment for the trip's bus. Unlike the trip snapshot above,
   * this is LIVE data: it stays editable after departure and drives the
   * "current bus driver" block, so it is never gated on `tripFrozen`.
   */
  async function assignToBus() {
    if (!driverValidation.validate()) return;
    if (!ownerId || !trip) return;
    const result = await assignBusDriver(ownerId, trip.busId, { driverUserId: driverId });
    if (!result.ok) { setError(driverValidation.failure(result)); return; }
    done(true, t("buses.toast.driverAssigned"));
    if (result.ok) {
      setDriverId("");
      await refreshDrivers();
    }
  }

  async function unassignFromBus() {
    if (!ownerId || !trip) return;
    if (!(await confirm({ title: t("buses.detail.unassignConfirm.title"), description: t("buses.detail.unassignConfirm.description"), confirmLabel: t("buses.detail.unassignConfirm.confirmLabel"), destructive: true }))) return;
    const result = await unassignBusDriver(ownerId, trip.busId);
    done(result.ok, result.ok ? t("buses.toast.driverUnassigned") : result.message);
    if (result.ok) await refreshDrivers();
  }

  // Rated bookings for this trip, fetched next to the trip itself so the screen
  // answers "how did this trip go" without leaving the page.
  useEffect(() => {
    if (!ownerId || !lineId) return;
    let cancelled = false;
    fetchTripFeedbackPage(ownerId, lineId, id, null).then((result) => {
      if (cancelled) return;
      if (result.ok) setFeedback(result.data);
    });
    return () => { cancelled = true; };
  }, [ownerId, lineId, id, feedbackReloadKey]);

  if (!ownerId) {
    return (
      <div className="dashboard-page max-w-xl">
        <h1 className="page-title">{t("trips.detail.fallbackTitle")}</h1>
        <p className="empty-state">{t("trips.detail.pickOwnerDescription")}</p>
        <Link href="/trips" className="text-sm font-medium text-[#059ff8] underline">
          {t("common.actions.backTo", { value: t("trips.title") })}
        </Link>
      </div>
    );
  }
  if (foundError && !trip) return <p role="alert" className="text-sm text-red-600">{foundError.message}</p>;
  if (!trip) return <DetailPageSkeleton />;

  const feedbackColumns: CommunityColumnDef<TripFeedbackRow>[] = [
    { field: "passenger.name", headerName: t("feedback.passenger"), valueGetter: (params) => params.data?.passenger.name || t("common.value.withoutName") },
    { field: "passenger.seats", headerName: t("common.fields.seats"), valueGetter: (params) => params.data?.passenger.seats },
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
      colId: "ratedAt",
      headerName: t("feedback.ratedAt"),
      valueGetter: (params) => {
        const at = params.data?.driverFeedback.ratedAt ?? params.data?.busFeedback.ratedAt;
        return at ? new Date(at).toLocaleString("ar-EG") : "—";
      },
    },
  ];

  const snapshottedDriverId = trip.driverUserId;
  // Departed (or finished) trips have a historical driver: the API refuses a
  // change, so the controls say so instead of failing on click.
  const tripFrozen = trip.status !== "SCHEDULED";
  // What the picker actually changes: the bus's ACTIVE assignment. The trip's
  // own driverUserId is a departure snapshot and never changes afterwards, so
  // showing only that made a successful assign look broken.
  const busDriver = drivers.find((driver) =>
    (driver.assignments ?? []).some(
      (assignment) => assignment.busId === trip.busId && assignment.status === "ACTIVE",
    ),
  );

  return (
    <ValidationScope validation={validation}><div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{trip.origin ?? "—"} ← {trip.destination ?? "—"}</h1>
          <p className="page-description">{t("trips.detail.description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 max-md:w-full">
          <span className={trip.status === "CANCELLED" ? "status-pill status-pill-muted" : "status-pill"}>{TRIP_STATUS_AR[trip.status]}</span>
          <AsyncButton type="button" variant="destructive" className="max-md:w-full" onClick={remove}><Trash2 className="size-4" /> {t("trips.detail.deleteTrip")}</AsyncButton>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel-card p-5 sm:p-6">
          <h2 className="section-title">{t("trips.detail.sections.schedule")}</h2>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{t("trips.detail.from")}</span>
                <Input value={trip.origin ?? ""} readOnly />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{t("trips.detail.to")}</span>
                <Input value={trip.destination ?? ""} readOnly />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{t("trips.detail.departureAt")}</span>
                <Input fieldName="departAt" dir="ltr" type="datetime-local" value={departAt} onChange={(e) => setDepartAt(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{t("common.fields.fare")}</span>
                <Input fieldName="fare" dir="ltr" inputMode="decimal" value={fare} onChange={(e) => setFare(e.target.value)} />
              </label>
            </div>
            <p className="text-xs text-[#687886]">{t("trips.detail.routeFromLineHint", { lineName: trip.line?.name ?? "—" })}</p>
            <div className="rounded-xl bg-[#f8fbfd] p-3 text-sm">
              <span className="block text-[#606060]">{t("trips.detail.bus")}</span>
              {bus ? <strong dir="ltr">{bus.plateNumber ?? "—"}</strong> : <InlineBlockSkeleton className="h-5 w-36" />}
              <span className="ms-2 text-[#606060]">{t("trips.detail.fields.capacityInline")} {bus?.capacity ?? "—"}</span>
              <span className="mt-2 flex items-center gap-2">
                <span className="text-[#606060]">{t("common.fields.busRatingAvg")}</span>
                <RatingCell value={busRatingAvg} />
              </span>
              <span className="mt-2 flex items-center gap-2">
                <span className="text-[#606060]">{t("trips.detail.busCurrentDriver")}</span>
                {busDriver ? (
                  <>
                    <DriverAvatar name={busDriver.name} picture={busDriver.picture} size="sm" />
                    <strong>{busDriver.name || t("common.value.withoutName")}</strong>
                  </>
                ) : (
                  <strong>{t("common.value.unassigned")}</strong>
                )}
              </span>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium">{t("trips.detail.assignTripDriver")}</span>
                <ValidationScope validation={driverValidation}><Select fieldName="driverUserId" aria-label={t("trips.detail.assignDriverAria")} value={driverId} onChange={(event) => setDriverId(event.target.value)} className="select-field w-full" disabled={!bus || tripFrozen}>
                  <option value="">{t("trips.detail.pickDriver")}</option>
                  {drivers.map((driver) => <option key={driver.userId ?? driver.id} value={driver.userId ?? driver.id}>{driver.name || driver.nickname || driver.phoneNumber || t("trips.detail.unnamedDriver")}</option>)}
                </Select></ValidationScope>
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <AsyncButton type="button" onClick={assignTripDriver} disabled={tripFrozen}>{t("trips.detail.assignDriverAria")}</AsyncButton>
                <AsyncButton type="button" variant="secondary" onClick={unassignTripDriver} disabled={!trip.driverUserId || tripFrozen}>
                  {t("trips.detail.assignDriverAria")}
                </AsyncButton>
              </div>
              {tripFrozen ? <small className="mt-1 block text-xs text-[#687886]">{t("trips.detail.driverFrozenHint")}</small> : null}
              <div className="mt-2 flex flex-wrap gap-2 border-t border-[#e4ecf2] pt-2">
                <AsyncButton type="button" onClick={assignToBus} disabled={!bus}>{t("trips.detail.assignBusDriver")}</AsyncButton>
                <AsyncButton type="button" variant="secondary" onClick={unassignFromBus} disabled={!bus || !busDriver}>
                  {t("trips.detail.unassignBusDriver")}
                </AsyncButton>
              </div>
            </div>
            <div className="rounded-xl bg-[#f8fbfd] p-3 text-sm">
              <span className="block text-[#606060]">{t("common.fields.snapshottedDriver")}</span>
              {snapshottedDriverId ? (
                <div className="mt-1 flex items-center gap-2">
                  <DriverAvatar
                    name={drivers.find((driver) => driver.userId === snapshottedDriverId)?.name}
                    picture={drivers.find((driver) => driver.userId === snapshottedDriverId)?.picture}
                    size="sm"
                  />
                  <strong>{drivers.find((driver) => driver.userId === snapshottedDriverId)?.name ?? t("common.value.withoutName")}</strong>
                </div>
              ) : (
                <strong>{t("common.value.unassigned")}</strong>
              )}
              <small className="mt-1 block text-xs text-[#687886]">{t("trips.detail.driverSnapshotHint")}</small>
            </div>
            <div className="flex gap-2">
              <AsyncButton type="button" onClick={save}>{t("common.actions.save")}</AsyncButton>
            </div>
          </div>
        </div>
        <div className="panel-card p-5 sm:p-6">
          <h2 className="section-title">{t("trips.detail.sections.status")}</h2>
          <div className="flex flex-wrap gap-2">
            {(["SCHEDULED", "DEPARTED", "COMPLETED"] as const).map((s) => (
              <AsyncButton
                key={s}
                type="button"
                variant={status === s ? "default" : "secondary"}
                onClick={() => move(s)}
                disabled={status === s}
              >
                {TRIP_STATUS_AR[s]}
              </AsyncButton>
            ))}
            <AsyncButton type="button" variant="destructive" onClick={cancel} disabled={status === "CANCELLED"}>
              {t("trips.detail.cancelTrip")}
            </AsyncButton>
          </div>
          <Button asChild variant="secondary" className="mt-4">
            <Link href={`/trips/${trip.id}/feedback?ownerId=${ownerId}`}>{t("trips.detail.viewFeedback")}</Link>
          </Button>
          <Button asChild variant="secondary" className="mt-2">
            <Link href={`/bookings?tripId=${encodeURIComponent(trip.id)}`}>{t("trips.detail.viewBookings")}</Link>
          </Button>
        </div>
      </div>

      <section className="mt-4 space-y-3">
        <div>
          <h2 className="section-title">{t("trips.detail.feedback.title")}</h2>
          <p className="page-description">{t("trips.detail.feedback.description")}</p>
        </div>
        {!feedback ? (
          <TableSkeleton rows={3} columns={feedbackColumns.length} />
        ) : (
          <CursorList<TripFeedbackRow>
            gridId={`trip-feedback-${id}`}
            key={`${id}-${feedbackReloadKey}`}
            scopeKey={`${ownerId}:${lineId}`}
            initialItems={feedback.items}
            initialCursor={feedback.nextCursor}
            loadMore={async (cursor) => {
              const result = await fetchTripFeedbackPage(ownerId, lineId, id, cursor);
              if (!result.ok) throw new Error(result.message);
              return result.data;
            }}
            keyOf={(row) => row.id}
            columnDefs={feedbackColumns}
            emptyMessage={t("trips.detail.feedback.empty")}
          />
        )}
      </section>
    </div></ValidationScope>
  );
}
