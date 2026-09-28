"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createTripSchema } from "@/lib/schemas/p1";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { createTrip, type Trip } from "@/lib/actions/trips";
import { apiGet, type CursorPage } from "@/lib/actions/http";
import { useFilterStore } from "@/stores/filters";
import { FleetPicker } from "@/components/fleet-picker";
import { setFleetScopeCookie } from "@/lib/fleet-scope-cookie";
import { fetchTripLines, type TripLine } from "@/lib/actions/trip-lines";
import { qk, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

type Values = z.input<typeof createTripSchema>;
type BusOpt = { id: string; registrationNumber: string; plateNumber?: string | null; lineId?: string | null; line?: { id: string; name: string; code: string } | null };

/** نافذة إضافة رحلة — بتفتح في نفس الصفحة من غير تنقل، وتقدر تتثبت على أسطول/عربية معينة. */
export function CreateTripDialog({
  open,
  onClose,
  onCreated,
  lockedFleetId,
  lockedBusId,
}: {
  open: boolean;
  onClose: () => void;
  /** Extra cache hook for callers with their own list (e.g. fleet tab). */
  onCreated?: (trip: Trip) => void;
  /** When set, the fleet is fixed and the picker is hidden. */
  lockedFleetId?: string;
  /** When set, the bus is fixed and the picker is hidden (e.g. from a bus page). */
  lockedBusId?: string;
}) {
  const queryClient = useQueryClient();
  const { fleetId: scopedFleetId, setFleetId } = useFilterStore();
  const [fleetId, setLocalFleetId] = useState(lockedFleetId ?? scopedFleetId ?? "");
  const [buses, setBuses] = useState<BusOpt[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: tripLines } = useApiQuery<TripLine[]>(qk.tripLines, fetchTripLines, { enabled: open });

  const form = useForm<Values>({
    resolver: zodResolver(createTripSchema),
    defaultValues: { busId: lockedBusId ?? "", origin: "", destination: "", departAt: "", routeId: undefined },
  });

  useEffect(() => {
    if (!open || !fleetId) return;
    apiGet<{ items: BusOpt[] }>(`/api/fleet-owners/fleets/${fleetId}/buses?limit=100`).then((r) => {
      if (r.ok) setBuses(r.data.items);
    });
  }, [open, fleetId]);

  // العربية المقفولة بتتعاد تسجيلها في الفورم بعد تحميل قايمة عربيات الأسطول
  useEffect(() => {
    if (open && lockedBusId && buses.some((bus) => bus.id === lockedBusId)) {
      if (form.getValues("busId") !== lockedBusId) {
        form.setValue("busId", lockedBusId, { shouldValidate: true });
      }
    }
  }, [open, lockedBusId, buses, form]);

  const selectedBus = buses.find((bus) => bus.id === form.watch("busId"));
  const selectedLine = selectedBus?.lineId ? (tripLines ?? []).find((line) => line.id === selectedBus.lineId) : undefined;
  const selectedDirection = selectedLine?.directions.find((item) => item.id === form.watch("routeId"));
  // From/to dropdowns read the CURRENT direction's stations (pair-aware):
  // boarding-capable rows for origin, landing-capable rows for destination.
  const boardingStops = (selectedDirection?.stations ?? []).filter(
    (station) => station.stopType === "BOARDING" || station.stopType === "BOTH",
  );
  const landingStops = (selectedDirection?.stations ?? []).filter(
    (station) => station.stopType === "LANDING" || station.stopType === "BOTH",
  );
  function selectDirection(routeId: string) {
    const direction = selectedLine?.directions.find((item) => item.id === routeId);
    form.setValue("routeId", routeId || undefined, { shouldValidate: true });
    if (direction) {
      const boarding = direction.stations.filter((s) => s.stopType === "BOARDING" || s.stopType === "BOTH");
      const landing = direction.stations.filter((s) => s.stopType === "LANDING" || s.stopType === "BOTH");
      form.setValue("origin", boarding[0]?.station.name ?? direction.origin, { shouldValidate: true });
      form.setValue("destination", landing.at(-1)?.station.name ?? direction.destination, { shouldValidate: true });
    } else {
      form.setValue("origin", "", { shouldValidate: true });
      form.setValue("destination", "", { shouldValidate: true });
    }
  }

  function resetForm() {
    setFormError(null);
    form.reset();
  }

  async function onSubmit(values: Values) {
    setFormError(null);
    if (!fleetId) {
      setFormError(t("trips.createDialog.errors.pickFleet"));
      return;
    }
    if (!selectedBus?.lineId) {
      setFormError(t("trips.createDialog.errors.pickLine"));
      return;
    }
    if (!values.routeId) {
      setFormError(t("trips.createDialog.errors.pickDirection"));
      return;
    }
    // Origin must come before destination on the chosen direction (same
    // converted-pair rule as passenger booking: X → X is not a trip).
    if (values.origin === values.destination) {
      setFormError(t("trips.createDialog.errors.sameStop"));
      return;
    }
    if (selectedDirection) {
      const ordered = selectedDirection.stations;
      const originIdx = ordered.findIndex(
        (s) => s.station.name === values.origin && (s.stopType === "BOARDING" || s.stopType === "BOTH"),
      );
      const destIdx = [...ordered].reverse().findIndex(
        (s) => s.station.name === values.destination && (s.stopType === "LANDING" || s.stopType === "BOTH"),
      );
      const destinationIdx = destIdx === -1 ? -1 : ordered.length - 1 - destIdx;
      if (originIdx === -1 || destinationIdx === -1 || originIdx >= destinationIdx) {
        setFormError(t("trips.createDialog.errors.stopOrder"));
        return;
      }
    }
    setFleetId(fleetId);
    setFleetScopeCookie(fleetId);
    const r = await createTrip(fleetId, values);
    if (!r.ok) {
      setFormError(r.message);
      return;
    }
    // تحديث فوري لجدول الرحلات من غير إعادة تحميل
    upsertInCursorList(queryClient, qk.trips(null), { ...r.data, fleetName: fleetLabel, busName: selectedBus.plateNumber ?? selectedBus.registrationNumber, driverName: t("common.value.unassigned") });
    onCreated?.(r.data);
    resetForm();
    onClose();
  }

  const { data: fleetsPage } = useApiQuery<CursorPage<{ id: string; name: string }>>(
    ["fleets", "options"],
    () => apiGet<CursorPage<{ id: string; name: string }>>("/api/fleet-owners/fleets?limit=100"),
    { enabled: open },
  );
  const fleetLabel = (fleetsPage?.items ?? []).find((fleet) => fleet.id === fleetId)?.name ?? "—";

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title={t("trips.createDialog.title")} description={t("trips.createDialog.description")} size="md">
      <div>
        {lockedFleetId ? null : (
          <div className="mb-4">
            <FleetPicker value={fleetId} onChange={(id) => { setLocalFleetId(id); form.setValue("busId", ""); form.setValue("routeId", undefined); }} />
          </div>
        )}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {lockedBusId ? null : (
            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">{t("trips.createDialog.busLabel")}</span>
              <select aria-label={t("trips.createDialog.pickBus")} value={form.watch("busId")} onChange={(event) => { form.setValue("busId", event.target.value, { shouldValidate: true }); form.setValue("routeId", undefined); form.setValue("origin", ""); form.setValue("destination", ""); }} onBlur={() => form.trigger("busId")} className="select-field w-full">
                <option value="">{t("trips.createDialog.pickBusOption")}</option>
                {buses.map((b) => (
                  <option key={b.id} value={b.id}>{b.registrationNumber}</option>
                ))}
              </select>
            </label>
          )}
          {selectedBus && !selectedLine && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{t("trips.createDialog.busWithoutLine")}</p>}
          {selectedLine && <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("trips.createDialog.directionLabel")}</span><select aria-label={t("trips.createDialog.pickDirection")} value={form.watch("routeId") ?? ""} onChange={(event) => selectDirection(event.target.value)} className="select-field w-full"><option value="">{t("trips.createDialog.pickDirectionOption")}</option>{selectedLine.directions.map((direction) => <option key={direction.id} value={direction.id}>{direction.direction === "OUTBOUND" ? t("tripLines.direction.outbound") : t("tripLines.direction.return")} · {direction.origin} ← {direction.destination}</option>)}</select></label>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">{t("trips.createDialog.originLabel")}</span>
              <select aria-label={t("trips.createDialog.pickOrigin")} value={form.watch("origin")} onChange={(event) => form.setValue("origin", event.target.value, { shouldValidate: true })} disabled={!selectedDirection} className="select-field w-full">
                <option value="">{t("trips.createDialog.pickOriginOption")}</option>
                {boardingStops.map((station) => (
                  <option key={`${station.id}`} value={station.station.name}>
                    {station.station.name} · {station.stopType === "BOTH" ? t("enums.stopUse.both") : t("enums.stopUse.boarding")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">{t("trips.createDialog.destinationLabel")}</span>
              <select aria-label={t("trips.createDialog.pickDestination")} value={form.watch("destination")} onChange={(event) => form.setValue("destination", event.target.value, { shouldValidate: true })} disabled={!selectedDirection} className="select-field w-full">
                <option value="">{t("trips.createDialog.pickDestinationOption")}</option>
                {landingStops.map((station) => (
                  <option key={`${station.id}`} value={station.station.name}>
                    {station.station.name} · {station.stopType === "BOTH" ? t("enums.stopUse.both") : t("enums.stopUse.landing")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("trips.createDialog.departureAt")}</span>
            <Input dir="ltr" type="datetime-local" {...form.register("departAt")} />
          </label>
          {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>{t("common.actions.cancel")}</Button>
            <Button type="submit" variant="success" loading={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t("common.loading.saving") : t("trips.createDialog.submit")}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
