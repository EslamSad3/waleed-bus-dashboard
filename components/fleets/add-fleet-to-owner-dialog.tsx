"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createFleet } from "@/lib/actions/fleets";
import { fetchFleetOwnersPage, type FleetOwnerAccount } from "@/lib/actions/fleet-owners";
import { qk, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

/**
 * Adds a company to an owner account. Shared by the owner list (row action) and the
 * owner detail screen (spec 014 removed the standalone `/fleets` page, so this dialog
 * is now the only way to create a company).
 */
export function AddFleetToOwnerDialog({
  open,
  owner,
  onClose,
  onCreated,
}: {
  open: boolean;
  owner: FleetOwnerAccount | null;
  onClose: () => void;
  onCreated?: (fleetId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [fleetName, setFleetName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setFleetName("");
    setError(null);
  }

  async function submit() {
    if (!owner) return;
    setError(null);
    if (!fleetName.trim()) {
      setError(t("fleetOwners.errors.fleetNameRequired"));
      return;
    }
    setSaving(true);
    const result = await createFleet({ name: fleetName.trim(), ownerId: owner.id, ownerRoleSlug: "fleet_owner" });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const refreshed = await fetchFleetOwnersPage(null);
    if (refreshed.ok) queryClient.setQueryData(qk.fleetOwners, refreshed.data);
    onCreated?.(result.data.id);
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open && Boolean(owner)} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title={t("fleetOwners.addFleetDialog.title")} description={owner ? t("fleetOwners.addFleetDialog.description", { ownerName: owner.name }) : undefined} size="sm">
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.fleetName")}</span>
          <Input value={fleetName} onChange={(event) => setFleetName(event.target.value)} placeholder={t("fleetOwners.placeholders.fleetGiza")} />
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>{t("common.actions.cancel")}</Button>
          <Button type="button" variant="success" onClick={() => void submit()} loading={saving}>{saving ? t("common.loading.adding") : t("fleetOwners.addFleetDialog.submit")}</Button>
        </div>
      </div>
    </Dialog>
  );
}
