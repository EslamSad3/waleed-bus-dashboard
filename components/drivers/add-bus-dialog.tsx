"use client";

import { requiredField } from "@/lib/field-validation";

import { useFieldValidation } from "@/components/ui/field-validation";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Dialog } from "@/components/ui/dialog";
import { BusPicker } from "@/components/drivers/bus-picker";
import { assignDriver } from "@/lib/actions/buses";
import { evictImpact, applyMutationCache } from "@/lib/cache/mutations";
import { useQueryClient } from "@/lib/queries";
import type { AssignDriverRef } from "@/components/drivers/assign-bus-dialog";
import { t } from "@/lib/i18n/t";

type AddMode = "existing" | "create";

/**
 * Drivers → Add bus: one action offering "Choose existing" (default) and
 * "Create new". Existing assigns immediately with the driver fixed; creating
 * hands the fixed driver scope to the shared bus-creation flow, which records
 * the bus under the driver's own company and assigns it in the same pass.
 */
export function AddBusDialog({
  open,
  onClose,
  driver,
  onAssigned,
  onCreateNew,
}: {
  open: boolean;
  onClose: () => void;
  driver: AssignDriverRef | null;
  onAssigned?: () => void;
  /** The caller opens the shared creation flow with this driver fixed. */
  onCreateNew: (driver: AssignDriverRef) => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AddMode>("existing");
  const [busId, setBusId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const driverKey = driver ? `${driver.ownerId}/${driver.userId}` : "";
  // Render-phase reset (no setState-in-effect): back to "existing" with no
  // stale pick whenever the dialog opens for another driver.
  const openKey = open ? driverKey : "";
  const [seenKey, setSeenKey] = useState(openKey);
  if (seenKey !== openKey) {
    setSeenKey(openKey);
    setMode("existing");
    setBusId("");
    setError(null);
    setSaving(false);
  }

  function requestClose() {
    if (saving) return;
    setMode("existing");
    setBusId("");
    setError(null);
    onClose();
  }

  function changeMode(next: AddMode) {
    if (mode === next || saving) return;
    setMode(next);
    // An incompatible pick must never ride along into the other branch.
    setBusId("");
    setError(null);
  }

  const validation = useFieldValidation(() => ({ busId: requiredField(busId, t("drivers.assignBus.pickRequired")) }));

  async function assignExisting() {
    if (!validation.validate()) return;
    if (!driver || saving) return;

    setError(null);
    setSaving(true);
    const result = await assignDriver(driver.ownerId, busId, { driverUserId: driver.userId });
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
      title={t("drivers.addBus.title")}
      description={driver ? t("drivers.addBus.description", { driver: driverLabel }) : undefined}
      size="sm"
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 block text-sm font-bold text-[#334454]">
            {t("drivers.addBus.modeLabel")}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${
                mode === "existing" ? "border-[#1f6f8b] bg-[#f2f8fb]" : "border-[#e4ecf2]"
              }`}
            >
              <input
                type="radio"
                name="driver-add-bus-mode"
                className="mt-0.5"
                checked={mode === "existing"}
                onChange={() => changeMode("existing")}
              />
              <span>
                <span className="block font-bold text-[#334454]">{t("drivers.addBus.modeExisting")}</span>
                <span className="block text-xs text-[#6b7c8c]">{t("drivers.addBus.modeExistingHint")}</span>
              </span>
            </label>
            <label
              className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${
                mode === "create" ? "border-[#1f6f8b] bg-[#f2f8fb]" : "border-[#e4ecf2]"
              }`}
            >
              <input
                type="radio"
                name="driver-add-bus-mode"
                className="mt-0.5"
                checked={mode === "create"}
                onChange={() => changeMode("create")}
              />
              <span>
                <span className="block font-bold text-[#334454]">{t("drivers.addBus.modeCreate")}</span>
                <span className="block text-xs text-[#6b7c8c]">{t("drivers.addBus.modeCreateHint")}</span>
              </span>
            </label>
          </div>
        </fieldset>

        {mode === "existing" && driver ? (
          <BusPicker ownerId={driver.ownerId} value={busId} onChange={(id) => { setBusId(id); setError(null); }} />
        ) : null}
        {mode === "existing" ? (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{t("drivers.assignBus.reassignNotice")}</p>
        ) : null}
        {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="danger" onClick={requestClose} disabled={saving}>
            {t("common.actions.cancel")}
          </Button>
          {mode === "existing" ? (
            <AsyncButton type="button" variant="success" onClick={assignExisting} disabled={saving} loading={saving}>
              {t("common.actions.confirmAssignment")}
            </AsyncButton>
          ) : (
            <Button
              type="button"
              variant="success"
              onClick={() => {
                if (driver) {
                  const fixed = driver;
                  requestClose();
                  onCreateNew(fixed);
                }
              }}
            >
              {t("drivers.addBus.modeCreate")}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
