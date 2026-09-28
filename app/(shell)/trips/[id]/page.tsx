"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { deleteTrip, findTripAcrossFleets, updateTrip, TRIP_STATUS_AR, type Trip } from "@/lib/actions/trips";
import { assignDriver, fetchBus, type Bus } from "@/lib/actions/buses";
import { apiGet } from "@/lib/actions/http";
import type { DriverRow } from "@/lib/actions/members";
import { qk, useApiQuery } from "@/lib/queries";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DetailPageSkeleton, InlineBlockSkeleton } from "@/components/ui/skeletons";
import { Trash2 } from "lucide-react";
import { t } from "@/lib/i18n/t";

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  const [fleetId, setFleetId] = useState<string | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departAt, setDepartAt] = useState("");
  const [status, setStatus] = useState<Trip["status"]>("SCHEDULED");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bus, setBus] = useState<Bus | null>(null);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [driverId, setDriverId] = useState("");

  // TanStack cache: الرحلة بتتجاب عبر طبقة الكاش والتعديلات بتكتب فيها فورًا
  const { data: tripData, error: tripError } = useApiQuery(
    ["trip-found", id],
    () => findTripAcrossFleets(id),
  );
  // Render-phase sync from the query cache (no setState-in-effect)
  const [seenTripData, setSeenTripData] = useState<typeof tripData>(undefined);
  if (tripData && tripData !== seenTripData) {
    setSeenTripData(tripData);
    setFleetId(tripData.fleetId);
    setTrip(tripData.trip);
    setOrigin(tripData.trip.origin);
    setDestination(tripData.trip.destination);
    setDepartAt(tripData.trip.departAt.slice(0, 16));
    setStatus(tripData.trip.status);
    setFailed(null);
    setLoadedKey(id);
  }
  const fetchFailed = tripError?.message ?? null;

  useEffect(() => {
    if (!fleetId || !trip) return;
    fetchBus(fleetId, trip.busId).then((result) => {
      if (result.ok) setBus(result.data);
    });
    apiGet<{ items: DriverRow[] }>("/api/fleet/drivers?limit=100", fleetId).then((result) => {
      if (result.ok) setDrivers(result.data.items.filter((driver) => driver.status === "ACTIVE"));
    });
  }, [fleetId, trip]);

  function done(ok: boolean, msg: string, updated?: Trip) {
    setError(ok ? null : msg);
    setNote(ok ? msg : null);
    if (ok && updated) setTrip(updated);
  }

  async function save() {
    if (!fleetId) return;
    const iso = departAt ? new Date(departAt).toISOString() : undefined;
    const r = await updateTrip(fleetId, id, { origin, destination, departAt: iso });
    done(r.ok, r.ok ? t("common.toast.saved") : r.message, r.ok ? r.data : undefined);
  }

  async function move(next: Trip["status"]) {
    if (!fleetId) return;
    const r = await updateTrip(fleetId, id, { status: next });
    if (r.ok) setStatus(r.data.status);
    done(r.ok, r.ok ? t("common.toast.saved") : r.message, r.ok ? r.data : undefined);
  }

  async function cancel() {
    if (!(await confirm({ title: t("trips.detail.cancelConfirm.title"), description: t("trips.detail.cancelConfirm.description"), confirmLabel: t("trips.detail.cancelConfirm.confirmLabel"), destructive: true }))) return;
    await move("CANCELLED");
  }

  async function remove() {
    if (!fleetId) return;
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("trips.detail.deleteConfirm.description"), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const r = await deleteTrip(fleetId, id);
    if (!r.ok) {
      done(false, r.message);
      return;
    }
    router.push("/trips");
    router.refresh();
  }

  async function assignTripDriver() {
    if (!fleetId || !trip || !driverId) {
      setError(t("trips.detail.errors.pickDriver"));
      return;
    }
    const result = await assignDriver(fleetId, trip.busId, { driverUserId: driverId });
    done(result.ok, result.ok ? t("trips.detail.toast.driverAssigned") : result.message);
    if (result.ok) {
      const refreshed = await apiGet<{ items: DriverRow[] }>("/api/fleet/drivers?limit=100", fleetId);
      if (refreshed.ok) setDrivers(refreshed.data.items.filter((driver) => driver.status === "ACTIVE"));
    }
  }

  if (failed && loadedKey === id) return <p role="alert" className="text-sm text-red-600">{failed}</p>;
  if (!trip || loadedKey !== id || !fleetId) return <DetailPageSkeleton />;

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1"><h1 className="page-title">{trip.origin} ← {trip.destination}</h1><p className="page-description">{t("trips.detail.description")}</p></div>
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
                <Input value={origin} onChange={(e) => setOrigin(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{t("trips.detail.to")}</span>
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t("trips.detail.departureAt")}</span>
              <Input dir="ltr" type="datetime-local" value={departAt} onChange={(e) => setDepartAt(e.target.value)} />
            </label>
            <div className="rounded-xl bg-[#f8fbfd] p-3 text-sm">
              <span className="block text-[#606060]">{t("trips.detail.bus")}</span>
              {bus ? <strong>{bus.registrationNumber}</strong> : <InlineBlockSkeleton className="h-5 w-36" />}
              {bus?.plateNumber ? <span className="ms-2 text-[#606060]" dir="ltr">{bus.plateNumber}</span> : null}
              <span className="ms-2 text-[#606060]">{t("trips.detail.fields.capacityInline")} {bus?.capacity ?? "—"}</span>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium">{t("trips.detail.assignSameFleetDriver")}</span>
                <select aria-label={t("trips.detail.assignDriverAria")} value={driverId} onChange={(event) => setDriverId(event.target.value)} className="select-field w-full" disabled={!bus}>
                  <option value="">{t("trips.detail.pickDriver")}</option>
                  {drivers.map((driver) => <option key={driver.userId ?? driver.id} value={driver.userId ?? driver.id}>{driver.name || driver.nickname || driver.phoneNumber || t("trips.detail.unnamedDriver")}</option>)}
                </select>
              </label>
              <AsyncButton type="button" className="mt-2" onClick={assignTripDriver} disabled={!driverId}>{t("trips.detail.assignDriver")}</AsyncButton>
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
            <Link href={`/bookings?tripId=${encodeURIComponent(trip.id)}`}>{t("trips.detail.viewBookings")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
