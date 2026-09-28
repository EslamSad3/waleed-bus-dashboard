"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { FleetBookingsTab, FleetBusesTab, FleetReportsTab, FleetTripsTab } from "@/components/fleets/fleet-detail-listings";
import { MembersTab } from "@/components/fleets/members-tab";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
import { setFleetScopeCookie } from "@/lib/fleet-scope-cookie";
import { assignFleetVip, deleteFleet, fetchFleet, fetchVipTiers, updateFleet, type Fleet, type VipTier } from "@/lib/actions/fleets";
import { fetchFleetOwnersPage, type FleetOwnerAccount } from "@/lib/actions/fleet-owners";
import { addMember, fetchMembersPage, type MemberPage } from "@/lib/actions/members";
import { useFilterStore } from "@/stores/filters";
import { qk, patchDetail, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { t as tr } from "@/lib/i18n/t";

const TABS = [
  { key: "overview", label: tr("common.tab.overview") },
  { key: "buses", label: tr("common.tab.buses") },
  { key: "members", label: tr("common.tab.members") },
  { key: "trips", label: tr("common.tab.trips") },
  { key: "bookings", label: tr("common.tab.bookings") },
  { key: "reports", label: tr("common.tab.reports") },
] as const;

type OwnerPage = { items: FleetOwnerAccount[]; nextCursor: string | null };

/** نافذة إضافة صاحب عربية للأسطول كعضو (issue 13) — القايمة بتستثني اللي متضاف بالفعل. */
function AddOwnerDialog({ open, fleetId, onClose }: { open: boolean; fleetId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [ownerId, setOwnerId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: ownersPage, isLoading: ownersLoading } = useApiQuery<OwnerPage>(qk.fleetOwners, () => fetchFleetOwnersPage(null), { enabled: open });
  // أعضاء الأسطول الحاليين — عشان نستبعدهم من القايمة
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
      setError(tr("fleets.detail.errors.pickOwner"));
      return;
    }
    const r = await addMember(fleetId, { userId: ownerId, roleSlug: "fleet-owner" });
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title={tr("fleets.detail.addOwnerDialog.title")} description={tr("fleets.detail.addOwnerDialog.description")} size="sm">
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{tr("fleets.detail.fields.fleetOwnerInline")}</span>
          {ownersLoading ? (
            <span role="status" className="block">
              <span className="sr-only">{tr("common.loading.more")}</span>
              <Skeleton aria-hidden="true" className="h-11 w-full rounded-xl" />
            </span>
          ) : (
            <select aria-label={tr("fleets.detail.addOwnerDialog.pickOwner")} value={ownerId} onChange={(event) => { setOwnerId(event.target.value); setError(null); }} className="select-field w-full">
              <option value="">{ownerOptions.length ? tr("fleets.detail.addOwnerDialog.pickOwnerOption") : tr("fleets.detail.addOwnerDialog.noOwners")}</option>
              {ownerOptions.map((owner) => (
                <option key={owner.id} value={owner.id}>{owner.name ?? owner.phoneNumber ?? owner.id}</option>
              ))}
            </select>
          )}
        </label>
        {!ownersLoading && ownerOptions.length === 0 ? (
          <p className="rounded-xl bg-[#eaf6ff] p-3 text-sm text-[#00134c]">{tr("fleets.detail.addOwnerDialog.allAdded")}</p>
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

export default function FleetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  const setFleetId = useFilterStore((s) => s.setFleetId);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string>("overview");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [vipTierId, setVipTierId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);

  const { data: fleet, isLoading, error: fleetError } = useApiQuery<Fleet>(qk.fleet(id), () => fetchFleet(id));
  const { data: tiers } = useApiQuery<VipTier[]>(qk.vipTiers, () => fetchVipTiers());

  // Render-phase sync from the query cache
  const [seenFleet, setSeenFleet] = useState<Fleet | null>(null);
  if (fleet && fleet !== seenFleet) {
    setSeenFleet(fleet);
    setName(fleet.name);
    setIsActive(fleet.isActive);
    setVipTierId(fleet.vipTierId ?? "");
  }

  useEffect(() => {
    setFleetId(id);
    setFleetScopeCookie(id);
  }, [id, setFleetId]);

  async function saveVip() {
    setError(null);
    setStatus(null);
    const r = await assignFleetVip(id, vipTierId || null);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    patchDetail(queryClient, qk.fleet(id), r.data);
    setVipTierId(r.data.vipTierId ?? "");
    setStatus(tr("fleets.detail.toast.vipSaved"));
  }

  async function save() {
    setError(null);
    setStatus(null);
    const r = await updateFleet(id, { name, isActive });
    if (!r.ok) {
      setError(r.message);
      return;
    }
    // تحديث فوري للتفاصيل ولصف الأسطول في القايمة
    patchDetail(queryClient, qk.fleet(id), r.data);
    upsertInCursorList(queryClient, qk.fleets, r.data);
    setStatus(tr("common.toast.saved"));
    setEditOpen(false);
  }

  async function remove() {
    setError(null);
    setStatus(null);
    if (!(await confirm({ title: tr("common.actions.deleteConfirmTitle"), description: tr("fleets.detail.deleteConfirm.description"), confirmLabel: tr("common.actions.delete"), destructive: true }))) return;
    const r = await deleteFleet(id);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    router.push("/fleets");
    router.refresh();
  }

  if (fleetError) return <p role="alert" className="text-sm text-red-600">{fleetError.message}</p>;
  if (!fleet || isLoading) return <DetailPageSkeleton sections={2} />;

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0"><h1 className="page-title">{fleet.name}</h1><p className="page-description">{tr("fleets.detail.description")}</p></div>
        <div className="flex flex-wrap items-center gap-3 max-md:w-full max-md:justify-between">
          <span className={fleet.isActive ? "rounded-full bg-green-100 px-3 py-0.5 text-sm text-green-800" : "rounded-full bg-slate-200 px-3 py-0.5 text-sm text-slate-700"}>
            {fleet.isActive ? tr("common.status.active") : tr("common.status.inactive")}
          </span>
          <AsyncButton type="button" variant="destructive" onClick={remove}><Trash2 className="size-4" /> {tr("fleets.detail.deleteFleet")}</AsyncButton>
        </div>
      </div>

      <nav aria-label={tr("fleets.detail.tabsAria")} className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${tab === t.key ? "bg-[#059ff8] text-white" : "bg-white text-[#1a1a1a] hover:bg-[#d6eeff]"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
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
                  <UserPlus className="size-4" aria-hidden="true" /> {tr("fleets.detail.addOwner")}
                </Button>
              </div>
            </div>
          </div>
          <div className="panel-card p-5 sm:p-6">
            <p className="text-xs font-semibold text-[#71808d]">{tr("fleets.detail.vipTier")}</p>
            <p className="mt-1 text-lg font-bold text-[#17212b]">{fleet.vipTier ? `${fleet.vipTier.rank} · ${fleet.vipTier.name}` : tr("fleets.detail.noVipTier")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <select aria-label={tr("fleets.detail.vipTierAria")} value={vipTierId} onChange={(e) => setVipTierId(e.target.value)} className="select-field min-w-0 flex-1">
                <option value="">{tr("fleets.detail.noVipTierOption")}</option>
                {(tiers ?? []).map((tier) => <option key={tier.id} value={tier.id}>{tier.rank} · {tier.name}{tier.isActive ? "" : tr("common.status.inactiveSuffixShort")}</option>)}
                {fleet?.vipTier && !(tiers ?? []).some((t) => t.id === fleet.vipTier!.id) ? (
                  <option key={fleet.vipTier.id} value={fleet.vipTier.id}>{fleet.vipTier.rank} · {fleet.vipTier.name} {tr("fleets.detail.vipTierInactiveSuffix")}</option>
                ) : null}
              </select>
              <AsyncButton type="button" variant="success" onClick={saveVip}>{tr("common.actions.save")}</AsyncButton>
            </div>
          </div>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen} title={tr("fleets.detail.editDialog.title")} description={tr("fleets.detail.editDialog.description")} size="sm">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">{tr("common.fields.fleetName")}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 rounded-xl bg-[#f8fbfd] p-3 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[#059ff8]" />
            {tr("fleets.detail.activeFleetLabel")}
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="danger" onClick={() => setEditOpen(false)}>{tr("common.actions.cancel")}</Button>
            <AsyncButton type="button" variant="success" onClick={save}>{tr("common.actions.saveChanges")}</AsyncButton>
          </div>
        </div>
      </Dialog>

      <AddOwnerDialog open={ownerOpen} fleetId={id} onClose={() => setOwnerOpen(false)} />

      {tab === "buses" && <FleetBusesTab fleetId={id} />}
      {tab === "members" && <MembersTab fleetId={id} />}
      {tab === "trips" && <FleetTripsTab fleetId={id} />}
      {tab === "bookings" && <FleetBookingsTab fleetId={id} />}
      {tab === "reports" && <FleetReportsTab fleetId={id} />}
    </div>
  );
}
