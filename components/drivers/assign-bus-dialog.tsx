"use client";

import { requiredField } from "@/lib/field-validation";

import { useFieldValidation } from "@/components/ui/field-validation";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Dialog } from "@/components/ui/dialog";
import { BusPicker } from "@/components/drivers/bus-picker";
import { TripAssignmentPicker } from "@/components/trips/trip-assignment-picker";
import { assignDriver } from "@/lib/actions/buses";
import { evictImpact, applyMutationCache } from "@/lib/cache/mutations";
import { useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

export type AssignDriverRef = {
  userId: string;
  ownerId: string;
  name?: string | null;
  ownerName?: string | null;
};

/**
 * Drivers → Assign bus: the driver is fixed, the operator picks an active
 * bus from that driver's owner scope. The request is the same owner-scoped
 * assignment (`POST /fleet-owners/{ownerId}/buses/{busId}/driver` with
 * `{ driverUserId }`); only the fixed side is flipped versus the bus dialog.
 */
export function AssignBusDialog({
  open,
  onClose,
  driver,
  onAssigned,
}: {
  open: boolean;
  onClose: () => void;
  driver: AssignDriverRef | null;
  /** Extra hook for callers with local state (owner tables reload here). */
  onAssigned?: () => void;
}) {
  const queryClient = useQueryClient();
  const [busId, setBusId] = useState("");
  const [tripId, setTripId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const driverKey = driver ? `${driver.ownerId}/${driver.userId}` : "";
  // Render-phase reset (no setState-in-effect): another driver starts clean.
  const openKey = open ? driverKey : "";
  const [seenKey, setSeenKey] = useState(openKey);
  if (seenKey !== openKey) {
    setSeenKey(openKey);
    setBusId("");
    setTripId("");
    setError(null);
    setSaving(false);
  }

  function requestClose() {
    if (saving) return;
    setBusId("");
    setTripId("");
    setError(null);
    onClose();
  }

  const validation = useFieldValidation(() => ({ tripId: requiredField(tripId), busId: requiredField(busId, t("drivers.assignBus.pickRequired")) }));

  async function submit() {
    if (!validation.validate()) return;
    if (!driver || saving) return;

    setError(null);
    setSaving(true);
    const result = await assignDriver(driver.ownerId, busId, { driverUserId: driver.userId, tripId });
    setSaving(false);
    if (!result.ok) {
      setError(validation.failure(result));
      return;
    }
    applyMutationCache(
      queryClient,
      evictImpact(["buses"], ["bus"], ["bus-trips"], ["drivers"], ["owner-drivers"], ["driver"], ["driver-assignments"], ["driver-trip-rows"], ["driver-ratings"]),
      { ok: true, data: null },
    );
    onAssigned?.();
    requestClose();
  }

  const driverLabel = driver?.name ?? t("common.value.withoutName");

  return (
    <Dialog validation={validation}
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
      title={t("drivers.assignBus.title")}
      description={driver ? t("drivers.assignBus.description", { driver: driverLabel }) : undefined}
      size="sm"
    >
      <div className="space-y-4">
        {driver ? (
          <BusPicker ownerId={driver.ownerId} value={busId} onChange={(id) => { setBusId(id); setTripId(""); setError(null); }} />
        ) : null}
        {driver && busId ? <fieldset disabled={saving}><TripAssignmentPicker ownerId={driver.ownerId} busId={busId} value={tripId} onChange={setTripId} /></fieldset> : null}
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{t("drivers.assignBus.reassignNotice")}</p>
        {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="danger" onClick={requestClose} disabled={saving}>
            {t("common.actions.cancel")}
          </Button>
          <AsyncButton type="button" variant="success" onClick={submit} disabled={saving} loading={saving}>
            {t("common.actions.confirmAssignment")}
          </AsyncButton>
        </div>
      </div>
    </Dialog>
  );
}
