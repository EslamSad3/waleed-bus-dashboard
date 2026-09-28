"use client";

import { useMemo, useState } from "react";
import { Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { assignFleetVip, updateFleet, type Fleet } from "@/lib/actions/fleets";
import { fetchVipTiers, type VipTier } from "@/lib/actions/vip-tiers";
import { fetchFleetOwnersPage, type FleetOwnerAccount } from "@/lib/actions/fleet-owners";
import { addMember, fetchMembersPage, type MemberPage } from "@/lib/actions/members";
import { patchDetail, qk, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";
import { t as tr } from "@/lib/i18n/t";

type OwnerPage = { items: FleetOwnerAccount[]; nextCursor: string | null };

/** نافذة إضافة صاحب عربية للشركة كعضو (issue 13) — القايمة بتستثني اللي متضاف بالفعل. */
function AddOwnerDialog({ open, fleetId, onClose }: { open: boolean; fleetId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [ownerId, setOwnerId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: ownersPage, isLoading: ownersLoading } = useApiQuery<OwnerPage>(qk.fleetOwners, () => fetchFleetOwnersPage(null), { enabled: open });
  // أعضاء الشركة الحاليين — عشان نستبعدهم من القايمة
  const { data: membersPage } = useApiQuery<MemberPage>(qk.fleetMembers(fleetId), () => fetchMembersPage(fleetId, null), { enabled: open });

  const existingMemberIds = useMemo(() => new Set((membersPage?.items ?? []).map((member) => member.userId)), [membersPage]);
  const ownerOptions = (ownersPage?.items ?? []).filter((owner) => !existingMemberIds.has(owner.id));

  // لو المختار بقى عضو بالفعل (مثلاً بعد إضافة تانية) نرجّع الاختيار للوضع الافتراضي
  const ownerStillAvailable = !ownerId || ownerOptions.some((owner) => owner.id === ownerId);
  if (!ownerStillAvailable) {
    setOwnerId("");
  }

  function resetForm() {
    setOwnerId("");
    setError(null);
  }

  async function submit() {
    setError(null);
    if (!ownerId) {
      setError(tr("fleetOwners.fleets.detail.errors.pickOwner"));
      return;
    }
    const r = await addMember(fleetId, { userId: ownerId, roleSlug: "fleet_owner" });
    if (!r.ok) {
      setError(r.message);
      return;
    }
    const refreshed = await fetchMembersPage(fleetId, null);
    if (refreshed.ok) queryClient.setQueryData(qk.fleetMembers(fleetId), refreshed.data);
    // نجاح = نقفل النافذة فورًا — من غير رسالتين مع بعض
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title={tr("fleetOwners.fleets.detail.addOwnerDialog.title")} description={tr("fleetOwners.fleets.detail.addOwnerDialog.description")} size="sm">
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{tr("fleetOwners.fleets.detail.fields.fleetOwnerInline")}</span>
          {ownersLoading ? (
            <span role="status" className="block">
              <span className="sr-only">{tr("common.loading.more")}</span>
              <Skeleton aria-hidden="true" className="h-11 w-full rounded-xl" />
            </span>
          ) : (
            <select aria-label={tr("fleetOwners.fleets.detail.addOwnerDialog.pickOwner")} value={ownerId} onChange={(event) => { setOwnerId(event.target.value); setError(null); }} className="select-field w-full">
              <option value="">{ownerOptions.length ? tr("fleetOwners.fleets.detail.addOwnerDialog.pickOwnerOption") : tr("fleetOwners.fleets.detail.addOwnerDialog.noOwners")}</option>
              {ownerOptions.map((owner) => (
                <option key={owner.id} value={owner.id}>{owner.name ?? owner.phoneNumber ?? owner.id}</option>
              ))}
            </select>
          )}
        </label>
        {!ownersLoading && ownerOptions.length === 0 ? (
          <p className="rounded-xl bg-[#eaf6ff] p-3 text-sm text-[#00134c]">{tr("fleetOwners.fleets.detail.addOwnerDialog.allAdded")}</p>
        ) : null}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>{tr("common.actions.cancel")}</Button>
          <AsyncButton type="button" variant="success" onClick={submit} disabled={!ownerId}>{tr("common.actions.add")}</AsyncButton>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Fleet name / status / VIP tier plus the two fleet-level mutations (rename+toggle,
 * add owner). Extracted from the deleted `/fleets/[id]` route: the fleet-owner screen
 * now owns the only place fleets are administered (spec 014), so the summary has to be
 * a component rather than page markup. The page keeps deletion, which is a
 * navigation-level action.
 */
export function FleetSummaryCard({ fleet, onChanged }: { fleet: Fleet; onChanged?: (next: Fleet) => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(fleet.name);
  const [isActive, setIsActive] = useState(fleet.isActive);
  const [vipTierId, setVipTierId] = useState(fleet.vipTierId ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);

  const { data: tiers } = useApiQuery<VipTier[]>(qk.vipTiers, () => fetchVipTiers());

  // Render-phase sync from the query cache (mirrors the previous page behaviour).
  const [seenFleet, setSeenFleet] = useState<Fleet | null>(null);
  if (fleet !== seenFleet) {
    setSeenFleet(fleet);
    setName(fleet.name);
    setIsActive(fleet.isActive);
    setVipTierId(fleet.vipTierId ?? "");
  }

  async function saveVip() {
    setError(null);
    setStatus(null);
    const r = await assignFleetVip(fleet.id, vipTierId || null);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    patchDetail(queryClient, qk.fleet(fleet.id), r.data);
    upsertInCursorList(queryClient, qk.fleets, r.data);
    onChanged?.(r.data);
    setVipTierId(r.data.vipTierId ?? "");
    setStatus(tr("fleetOwners.fleets.detail.toast.vipSaved"));
  }

  async function save() {
    setError(null);
    setStatus(null);
    const r = await updateFleet(fleet.id, { name, isActive });
    if (!r.ok) {
      setError(r.message);
      return;
    }
    // تحديث فوري للتفاصيل ولصف الشركة في القايمة
    patchDetail(queryClient, qk.fleet(fleet.id), r.data);
    upsertInCursorList(queryClient, qk.fleets, r.data);
    onChanged?.(r.data);
    setStatus(tr("common.toast.saved"));
    setEditOpen(false);
  }

  return (
    <div className="grid max-w-3xl gap-4 lg:grid-cols-2">
      <div className="panel-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#71808d]">{tr("common.fields.fleetName")}</p>
            <p className="mt-1 text-lg font-bold text-[#17212b]">{fleet.name}</p>
            <span className={`mt-3 ${fleet.isActive ? "status-pill" : "status-pill status-pill-muted"}`}>{fleet.isActive ? tr("common.status.active") : tr("common.status.inactive")}</span>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" aria-hidden="true" /> {tr("common.actions.edit")}
            </Button>
            <Button type="button" onClick={() => setOwnerOpen(true)}>
              <UserPlus className="size-4" aria-hidden="true" /> {tr("fleetOwners.fleets.detail.addOwner")}
            </Button>
          </div>
        </div>
      </div>
      <div className="panel-card p-5 sm:p-6">
        <p className="text-xs font-semibold text-[#71808d]">{tr("fleetOwners.fleets.detail.vipTier")}</p>
        <p className="mt-1 text-lg font-bold text-[#17212b]">{fleet.vipTier ? `${fleet.vipTier.rank} · ${fleet.vipTier.name}` : tr("fleetOwners.fleets.detail.noVipTier")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select aria-label={tr("fleetOwners.fleets.detail.vipTierAria")} value={vipTierId} onChange={(e) => setVipTierId(e.target.value)} className="select-field min-w-0 flex-1">
            <option value="">{tr("fleetOwners.fleets.detail.noVipTierOption")}</option>
            {(tiers ?? []).map((tier) => <option key={tier.id} value={tier.id}>{tier.rank} · {tier.name}{tier.isActive ? "" : tr("common.status.inactiveSuffixShort")}</option>)}
            {fleet.vipTier && !(tiers ?? []).some((tier) => tier.id === fleet.vipTier!.id) ? (
              <option key={fleet.vipTier.id} value={fleet.vipTier.id}>{fleet.vipTier.rank} · {fleet.vipTier.name} {tr("fleetOwners.fleets.detail.vipTierInactiveSuffix")}</option>
            ) : null}
          </select>
          <AsyncButton type="button" variant="success" onClick={saveVip}>{tr("common.actions.save")}</AsyncButton>
        </div>
        {status && <p className="mt-2 text-xs text-[#4a5a68]">{status}</p>}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen} title={tr("fleetOwners.fleets.detail.editDialog.title")} description={tr("fleetOwners.fleets.detail.editDialog.description")} size="sm">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">{tr("common.fields.fleetName")}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 rounded-xl bg-[#f8fbfd] p-3 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[#059ff8]" />
            {tr("fleetOwners.fleets.detail.activeFleetLabel")}
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="danger" onClick={() => setEditOpen(false)}>{tr("common.actions.cancel")}</Button>
            <AsyncButton type="button" variant="success" onClick={save}>{tr("common.actions.saveChanges")}</AsyncButton>
          </div>
        </div>
      </Dialog>

      <AddOwnerDialog open={ownerOpen} fleetId={fleet.id} onClose={() => setOwnerOpen(false)} />
    </div>
  );
}
