"use client";

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
import { assignDriver, fetchBus, type Bus } from "@/lib/actions/buses";
import { apiGet } from "@/lib/actions/http";
import type { DriverRow } from "@/lib/actions/members";
import { DriverAvatar } from "@/components/owners/driver-avatar";
import { RatingCell } from "@/components/owners/rating-cell";
import { fetchTripFeedbackPage } from "@/lib/actions/feedback";
import { qk, useApiQuery } from "@/lib/queries";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DetailPageSkeleton, InlineBlockSkeleton } from "@/components/ui/skeletons";
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
  const confirm = useConfirm();
  const [ownerId, setOwnerId] = useState(scopeOwnerId ?? "");
  const [lineId, setLineId] = useState(scopeLineId ?? "");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bus, setBus] = useState<Bus | null>(null);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [driverId, setDriverId] = useState("");
  const [busRatingAvg, setBusRatingAvg] = useState<number | null>(null);
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

  function done(ok: boolean, msg: string, updated?: Trip) {
    setError(ok ? null : msg);
    setNote(ok ? msg : null);
    if (ok && updated) setTrip(updated);
  }

  async function save() {
    if (!ownerId || !lineId) return;
    const r = await updateTrip(ownerId, lineId, id, {
      departAt: departAt ? new Date(departAt).toISOString() : undefined,
      fare: fare.trim(),
    });
    done(r.ok, r.ok ? t("common.toast.saved") : r.message, r.ok ? r.data : undefined);
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
    if (!ownerId || !lineId) return;
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("trips.detail.deleteConfirm.description"), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const r = await deleteTrip(ownerId, lineId, id);
    if (!r.ok) {
      done(false, r.message);
      return;
    }
    router.push("/trips");
    router.refresh();
  }

  async function assignTripDriver() {
    if (!ownerId || !trip || !driverId) {
      setError(t("trips.detail.errors.pickDriver"));
      return;
    }
    const result = await assignDriver(ownerId, trip.busId, { driverUserId: driverId });
    done(result.ok, result.ok ? t("trips.detail.toast.driverAssigned") : result.message);
    if (result.ok) {
      const refreshed = await apiGet<{ items: DriverRow[] }>(
        `/api/fleet-owners/${ownerId}/drivers?limit=100`,
      );
      if (refreshed.ok) setDrivers(refreshed.data.items.filter((driver) => driver.status === "ACTIVE"));
    }
  }

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

  const snapshottedDriverId = trip.driverUserId;

  return (
    <div className="dashboard-page">
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
      {note && <p role="status" className="text-sm text-green-700">{note}</p>}

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
                <Input dir="ltr" type="datetime-local" value={departAt} onChange={(e) => setDepartAt(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{t("common.fields.fare")}</span>
                <Input dir="ltr" inputMode="decimal" value={fare} onChange={(e) => setFare(e.target.value)} />
              </label>
            </div>
            <p className="text-xs text-[#687886]">{t("trips.detail.routeFromLineHint", { lineName: trip.line?.name ?? "—" })}</p>
            <div className="rounded-xl bg-[#f8fbfd] p-3 text-sm">
              <span className="block text-[#606060]">{t("trips.detail.bus")}</span>
              {bus ? <strong>{bus.registrationNumber}</strong> : <InlineBlockSkeleton className="h-5 w-36" />}
              {bus?.plateNumber ? <span className="ms-2 text-[#606060]" dir="ltr">{bus.plateNumber}</span> : null}
              <span className="ms-2 text-[#606060]">{t("trips.detail.fields.capacityInline")} {bus?.capacity ?? "—"}</span>
              <span className="mt-2 flex items-center gap-2">
                <span className="text-[#606060]">{t("common.fields.busRatingAvg")}</span>
                <RatingCell value={busRatingAvg} />
              </span>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium">{t("trips.detail.assignSameFleetDriver")}</span>
                <select aria-label={t("trips.detail.assignDriverAria")} value={driverId} onChange={(event) => setDriverId(event.target.value)} className="select-field w-full" disabled={!bus}>
                  <option value="">{t("trips.detail.pickDriver")}</option>
                  {drivers.map((driver) => <option key={driver.userId ?? driver.id} value={driver.userId ?? driver.id}>{driver.name || driver.nickname || driver.phoneNumber || t("trips.detail.unnamedDriver")}</option>)}
                </select>
              </label>
              <AsyncButton type="button" className="mt-2" onClick={assignTripDriver} disabled={!driverId}>{t("trips.detail.assignDriver")}</AsyncButton>
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
    </div>
  );
}
