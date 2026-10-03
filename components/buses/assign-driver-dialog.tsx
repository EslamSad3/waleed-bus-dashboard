"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Dialog } from "@/components/ui/dialog";
import { DriverPicker } from "@/components/buses/driver-picker";
import { assignDriver } from "@/lib/actions/buses";
import { evictImpact, applyMutationCache } from "@/lib/cache/mutations";
import { useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

export type AssignBusRef = {
  id: string;
  ownerId: string;
  plateNumber?: string | null;
};

/**
 * Buses → Assign driver: the bus is fixed, the operator picks an ACTIVE
 * driver from that bus's owner scope. Shared by the cross-owner bus list,
 * the owner bus tables, and the bus-detail assignment action.
 *
 * State resets whenever another row is opened; the dialog cannot close while
 * saving and the confirm guard blocks duplicate submissions.
 */
export function AssignDriverDialog({
  open,
  onClose,
  bus,
  onAssigned,
}: {
  open: boolean;
  onClose: () => void;
  bus: AssignBusRef | null;
  /** Extra hook for callers with local state (owner tables reload here). */
  onAssigned?: () => void;
}) {
  const queryClient = useQueryClient();
  const [driverUserId, setDriverUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const busKey = bus ? `${bus.ownerId}/${bus.id}` : "";
  // Render-phase reset (no setState-in-effect): opening the dialog for another
  // row starts clean — no stale driver, error, or in-flight flag rides along.
  const openKey = open ? busKey : "";
  const [seenKey, setSeenKey] = useState(openKey);
  if (seenKey !== openKey) {
    setSeenKey(openKey);
    setDriverUserId("");
    setError(null);
    setSaving(false);
  }

  function requestClose() {
    if (saving) return;
    setDriverUserId("");
    setError(null);
    onClose();
  }

  async function submit() {
    if (!bus || saving) return;
    if (!driverUserId) {
      setError(t("buses.assign.pickRequired"));
      return;
    }
    setError(null);
    setSaving(true);
    const result = await assignDriver(bus.ownerId, bus.id, { driverUserId });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    // One mutation touches the bus, every roster showing the driver, the
    // detail slots and the histories — refetch them, never patch blindly.
    applyMutationCache(
      queryClient,
      evictImpact(["buses"], ["bus"], ["bus-trips"], ["drivers"], ["owner-drivers"], ["driver"], ["driver-assignments"], ["driver-trip-rows"], ["driver-ratings"]),
      { ok: true, data: null },
    );
    onAssigned?.();
    requestClose();
  }

  const busLabel = bus?.plateNumber ?? t("common.value.withoutName");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
      title={t("buses.assign.title")}
      description={bus ? t("buses.assign.description", { bus: busLabel }) : undefined}
      size="sm"
    >
      <div className="space-y-4">
        {bus ? (
          <DriverPicker ownerId={bus.ownerId} value={driverUserId} onChange={(id) => { setDriverUserId(id); setError(null); }} />
        ) : null}
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{t("buses.assign.reassignNotice")}</p>
        {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="danger" onClick={requestClose} disabled={saving}>
            {t("common.actions.cancel")}
          </Button>
          <AsyncButton type="button" variant="success" onClick={submit} disabled={!driverUserId || saving} loading={saving}>
            {t("common.actions.confirmAssignment")}
          </AsyncButton>
        </div>
      </div>
    </Dialog>
  );
}
