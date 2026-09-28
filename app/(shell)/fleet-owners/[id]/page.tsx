"use client";

import { use, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ui/image-picker";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { FleetSections } from "@/components/fleets/fleet-sections";
import { FleetSummaryCard } from "@/components/fleets/fleet-summary-card";
import { AddFleetToOwnerDialog } from "@/components/fleets/add-fleet-to-owner-dialog";
import { deleteFleet, fetchFleet, type Fleet } from "@/lib/actions/fleets";
import { discardFleetOwnerPicture, fetchFleetOwner, stageFleetOwnerPicture, updateFleetOwner, type FleetOwnerAccount } from "@/lib/actions/fleet-owners";
import type { StagedUpload } from "@/lib/actions/http";
import { updateFleetOwnerSchema } from "@/lib/schemas/p1";
import { setFleetScopeCookie } from "@/lib/fleet-scope-cookie";
import { useFilterStore } from "@/stores/filters";
import { qk, patchDetail, useApiQuery, useQueryClient } from "@/lib/queries";
import { ChevronDown, ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
import { t } from "@/lib/i18n/t";

type OwnerTab = "account" | "fleets";

const TABS: { key: OwnerTab; label: string }[] = [
  { key: "account", label: t("fleetOwners.detail.tabs.account") },
  { key: "fleets", label: t("fleetOwners.detail.tabs.fleets") },
];

/**
 * The owner account and everything it owns, on one screen (spec 014).
 *
 * This page replaced the standalone `/fleets` and `/fleets/[id]` routes: an owner's
 * companies are expanded inline instead of behind a link, so the fleet summary and the
 * five fleet sections are components rather than a page. Only one company is open at a
 * time, which is also what keeps the fleet scope unambiguous — opening a company is
 * what sets `x-fleet-id` for the `/fleet/*` calls those sections make.
 */
export default function FleetOwnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fleet?: string }>;
}) {
  const { id } = use(params);
  // `/fleets/:fleetId` redirects here, so a bookmarked company link still lands on it.
  const { fleet: deepLinkedFleetId } = use(searchParams);
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const setStoreFleetId = useFilterStore((s) => s.setFleetId);
  const { data: owner, isPending, error: fetchError } = useApiQuery<FleetOwnerAccount>(qk.fleetOwner(id), () => fetchFleetOwner(id));

  const [tab, setTab] = useState<OwnerTab>(deepLinkedFleetId ? "fleets" : "account");
  const [openFleetId, setOpenFleetId] = useState<string | null>(deepLinkedFleetId ?? null);
  const [addFleetOpen, setAddFleetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isActive, setIsActive] = useState(true);

  // The deleted fleet page set the scope on mount; opening a company replaces that.
  useEffect(() => {
    if (!openFleetId) return;
    setStoreFleetId(openFleetId);
    setFleetScopeCookie(openFleetId);
  }, [openFleetId, setStoreFleetId]);

  function openEdit() {
    if (!owner) return;
    setName(owner.name ?? "");
    setNickname(owner.nickname ?? "");
    setPhone(owner.phoneNumber ?? "");
    setNationalId(owner.nationalId ?? "");
    setImageFile(null);
    setIsActive(owner.isActive);
    setError(null);
    setEditOpen(true);
  }

  async function save() {
    if (!owner) return;
    const parsed = updateFleetOwnerSchema.safeParse({ name, nickname, phone, nationalId, isActive });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("common.validation.reviewInput"));
      return;
    }
    setSaving(true);
    setError(null);
    setNote(null);
    // الصورة بتترفع الأول مباشر للتخزين السحابي — لو الرفع فشل مفيش تعديل
    // يتطبق، ولو الحفظ فشل بنمسح الصورة المرحلية.
    let staged: StagedUpload | null = null;
    if (imageFile) {
      const s = await stageFleetOwnerPicture(imageFile, id);
      if (!s.ok) {
        setSaving(false);
        setError(s.message);
        return;
      }
      staged = s.data;
    }
    const result = await updateFleetOwner(id, {
      ...parsed.data,
      ...(staged ? { picture: staged.publicUrl } : {}),
    });
    if (!result.ok) {
      if (staged) await discardFleetOwnerPicture(staged);
      setSaving(false);
      setError(result.message);
      return;
    }
    const refreshed = await fetchFleetOwner(id);
    if (refreshed.ok) patchDetail(queryClient, qk.fleetOwner(id), refreshed.data);
    setSaving(false);
    setNote(t("fleetOwners.detail.toast.saved"));
    setEditOpen(false);
  }

  async function removeFleet(fleet: Fleet) {
    setError(null);
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("fleetOwners.fleets.detail.deleteConfirm.description"), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteFleet(fleet.id);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (openFleetId === fleet.id) setOpenFleetId(null);
    const refreshed = await fetchFleetOwner(id);
    if (refreshed.ok) patchDetail(queryClient, qk.fleetOwner(id), refreshed.data);
  }

  if (fetchError) return <p role="alert" className="text-sm text-red-600">{fetchError.message}</p>;
  if (!owner || isPending) return <DetailPageSkeleton />;

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1"><h1 className="page-title truncate">{owner.name}</h1><p className="page-description">{owner.nickname}</p></div>
        <div className="flex flex-wrap items-center gap-2 max-md:w-full">
          <span className={owner.isActive ? "rounded-full bg-green-100 px-3 py-1 text-sm text-green-800" : "rounded-full bg-slate-200 px-3 py-1 text-sm"}>{owner.isActive ? t("common.status.active") : t("common.status.inactive")}</span>
          <Button type="button" variant="secondary" onClick={openEdit}><Pencil className="size-4" aria-hidden="true" /> {t("common.actions.edit")}</Button>
        </div>
      </div>
      {error && !editOpen ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {note ? <p role="status" className="text-sm text-green-700">{note}</p> : null}

      <nav aria-label={t("fleetOwners.detail.tabsAria")} className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            aria-current={tab === entry.key ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${tab === entry.key ? "bg-[#059ff8] text-white" : "bg-white text-[#1a1a1a] hover:bg-[#d6eeff]"}`}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {tab === "account" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel-card p-5 sm:p-6">
            <h2 className="section-title">{t("fleetOwners.detail.sections.account")}</h2>
            {owner.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={owner.picture} alt={t("fleetOwners.detail.imageAlt", { ownerName: owner.name })} className="mb-3 size-24 rounded-2xl object-cover" />
            ) : null}
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-[#606060]">{t("common.fields.phone")}</dt><dd dir="ltr" className="min-w-0 truncate">{owner.phoneNumber}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[#606060]">{t("common.fields.nationalId")}</dt><dd dir="ltr" className="min-w-0 truncate">{owner.nationalId ?? "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[#606060]">{t("common.fields.fleets")}</dt><dd className="min-w-0 truncate">{owner.fleets.length}</dd></div>
            </dl>
          </section>
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title">{t("common.fields.fleets")}</h2>
            <Button type="button" variant="secondary" onClick={() => setAddFleetOpen(true)}>{t("fleetOwners.detail.addFleet")}</Button>
          </div>

          {owner.fleets.length === 0 ? (
            <p className="panel-card p-5 text-sm text-[#606060]">{t("fleetOwners.detail.noFleets")}</p>
          ) : (
            <ul className="space-y-3">
              {owner.fleets.map((owned) => {
                const open = owned.id === openFleetId;
                return (
                  <li key={owned.id} className="panel-card overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                      <button
                        type="button"
                        onClick={() => setOpenFleetId(open ? null : owned.id)}
                        aria-expanded={open}
                        className="flex min-w-0 flex-1 items-center gap-2 text-start"
                      >
                        {open ? <ChevronDown className="size-4 shrink-0" aria-hidden="true" /> : <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />}
                        <span className="min-w-0 truncate font-bold">{owned.name}</span>
                        <span className={owned.isActive ? "status-pill" : "status-pill status-pill-muted"}>{owned.isActive ? t("common.status.active") : t("common.status.inactive")}</span>
                      </button>
                      <AsyncButton type="button" variant="destructive" onClick={() => void removeFleet(owned as Fleet)}>
                        <Trash2 className="size-4" aria-hidden="true" /> {t("fleetOwners.fleets.detail.deleteFleet")}
                      </AsyncButton>
                    </div>
                    {open ? (
                      <div className="space-y-4 border-t border-[#e4ecf2] p-4">
                        <OwnedFleetBody fleetId={owned.id} ownerId={id} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <AddFleetToOwnerDialog
        open={addFleetOpen}
        owner={owner}
        onClose={() => setAddFleetOpen(false)}
        onCreated={(fleetId) => setOpenFleetId(fleetId)}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen} title={t("fleetOwners.detail.editDialog.title")} description={t("fleetOwners.detail.editDialog.description")} size="lg">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">{t("common.fields.fullName")}</span><Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
            <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">{t("common.fields.nickname")}</span><Input value={nickname} onChange={(event) => setNickname(event.target.value)} /></label>
            <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">{t("common.fields.phoneNumber")}</span><Input dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" /></label>
            <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">{t("common.fields.nationalId")}</span><Input dir="ltr" value={nationalId} onChange={(event) => setNationalId(event.target.value)} inputMode="numeric" maxLength={14} /></label>
            <div className="sm:col-span-2">
              <ImagePicker
                label={t("fleetOwners.editDialog.imageLabel")}
                file={imageFile}
                onChange={setImageFile}
                existingUrl={owner?.picture ?? null}
                uploading={saving && Boolean(imageFile)}
                hint={t("common.image.hintUploadFile")}
              />
            </div>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-[#d8e4ec] bg-[#f8fbfd] p-4 text-sm font-bold text-[#334454]">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="size-4 accent-[#059ff8]" /> {t("fleetOwners.detail.editDialog.activeAccountShort")}
          </label>
          {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
            <Button type="button" variant="danger" onClick={() => setEditOpen(false)} disabled={saving}>{t("common.actions.cancel")}</Button>
            <Button type="button" variant="success" onClick={save} loading={saving}>{saving ? t("common.loading.saving") : t("common.actions.saveChanges")}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/**
 * Summary card + the five fleet sections for one company. The owner payload only nests
 * `{id, name, isActive}`, so the full row (needed for the VIP tier) is fetched here.
 */
function OwnedFleetBody({ fleetId, ownerId }: { fleetId: string; ownerId: string }) {
  const queryClient = useQueryClient();
  const { data: fleet, isPending, error } = useApiQuery<Fleet>(qk.fleet(fleetId), () => fetchFleet(fleetId));

  // The row that opens this body renders the owner's embedded fleet summary, which is a
  // different cache from qk.fleet(fleetId). Without this the row kept the old name after
  // a rename, or the old status after a toggle, until the page was reloaded.
  function mirrorToOwner(next: Fleet) {
    queryClient.setQueryData<FleetOwnerAccount>(qk.fleetOwner(ownerId), (prev) =>
      prev
        ? { ...prev, fleets: prev.fleets.map((owned) => (owned.id === next.id ? { ...owned, name: next.name, isActive: next.isActive } : owned)) }
        : prev,
    );
  }

  if (error) return <p role="alert" className="text-sm text-red-600">{error.message}</p>;
  if (!fleet || isPending) return <DetailPageSkeleton sections={1} />;
  return (
    <div className="space-y-4">
      <FleetSummaryCard fleet={fleet} onChanged={mirrorToOwner} />
      <FleetSections fleetId={fleet.id} />
    </div>
  );
}
