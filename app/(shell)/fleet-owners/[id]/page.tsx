"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ui/image-picker";
import { discardFleetOwnerPicture, fetchFleetOwner, stageFleetOwnerPicture, updateFleetOwner, type FleetOwnerAccount } from "@/lib/actions/fleet-owners";
import type { StagedUpload } from "@/lib/actions/http";
import { updateFleetOwnerSchema } from "@/lib/schemas/p1";
import { qk, patchDetail, useApiQuery, useQueryClient } from "@/lib/queries";
import { Pencil } from "lucide-react";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
import { t } from "@/lib/i18n/t";

export default function FleetOwnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: owner, isPending, error: fetchError } = useApiQuery<FleetOwnerAccount>(qk.fleetOwner(id), () => fetchFleetOwner(id));
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
          </dl>
        </section>
        <section className="panel-card p-5 sm:p-6">
          <h2 className="section-title">{t("common.fields.fleets")}</h2>
          <div className="space-y-2">{owner.fleets.map((fleet) => <Link key={fleet.id} href={`/fleets/${fleet.id}`} className="flex justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 hover:bg-[#d6eeff]"><span className="min-w-0 truncate">{fleet.name}</span><span className="shrink-0 text-sm text-[#606060]">{fleet.isActive ? t("common.status.active") : t("common.status.inactive")}</span></Link>)}</div>
          <Button asChild variant="secondary" className="mt-4 w-full sm:w-auto"><Link href="/fleets">{t("fleetOwners.detail.addFleet")}</Link></Button>
        </section>
      </div>

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
