"use client";

import * as schemas from "@/lib/schemas/p1";

import { schemaErrors } from "@/lib/field-validation";

import { useFieldValidation } from "@/components/ui/field-validation";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ui/image-picker";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { OwnerSections } from "@/components/owners/owner-sections";
import {
  deleteFleetOwner,
  discardFleetOwnerPicture,
  fetchFleetOwner,
  stageFleetOwnerPicture,
  updateFleetOwner,
  type FleetOwnerAccount,
} from "@/lib/actions/fleet-owners";
import type { StagedUpload } from "@/lib/actions/http";
import { updateFleetOwnerSchema } from "@/lib/schemas/p1";
import { setOwnerScopeCookie } from "@/lib/owner-scope-cookie";
import { useFilterStore } from "@/stores/filters";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { applyMutationCache, ownerImpact } from "@/lib/cache/mutations";
import { Pencil } from "lucide-react";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
import { t } from "@/lib/i18n/t";

/**
 * The owner account and everything it owns, on one screen. An owner user IS
 * the company, so there is no expandable "fleet" layer any more: the account and
 * company information sit at the top, and the seven owner sections read
 * `/fleet-owners/{ownerId}/…` directly. Opening this page is also what sets the
 * owner scope used by the cross-owner lists.
 */
export default function FleetOwnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const setStoreOwnerId = useFilterStore((s) => s.setOwnerId);
  const { data: owner, isPending, error: fetchError } = useApiQuery<FleetOwnerAccount>(
    qk.fleetOwner(id),
    () => fetchFleetOwner(id),
  );

  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    setStoreOwnerId(id);
    setOwnerScopeCookie(id);
  }, [id, setStoreOwnerId]);

  function openEdit() {
    validation.reset();
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

  const validation = useFieldValidation(() => schemaErrors(schemas.updateFleetOwnerSchema, { name: name.trim(), nickname: nickname.trim() || undefined, phone: phone.trim() || undefined, nationalId: nationalId.trim(), isActive }));

  async function save() {
    if (!validation.validate()) return;
    if (!owner) return;
    const parsed = updateFleetOwnerSchema.safeParse({
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      phone: phone.trim() || undefined,
      nationalId,
      isActive,
    });
    if (!parsed.success) return;
    setSaving(true);
    setError(null);
    // الصورة بتترفع الأول مباشر للتخزين السحابي — لو الرفع فشل مفيش تعديل
    // يتطبق، ولو الحفظ فشل بنمسح الصورة المرحلية.
    let staged: StagedUpload | null = null;
    if (imageFile) {
      const s = await stageFleetOwnerPicture(imageFile, id);
      if (!s.ok) {
        setSaving(false);
        setError(validation.failure(s));
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
      setError(validation.failure(result));
      return;
    }
    // The mutation already returns the whole account, so the screen, the detail
    // slot, the `/fleet-owners` list and every dependent view are updated from
    // it — no refetch round trip, and no manual page refresh. Patching only the
    // detail key is what left the list showing the old name after an edit here.
    applyMutationCache(queryClient, ownerImpact(result.data, "update"), result);
    setSaving(false);
    setEditOpen(false);
  }

  async function removeOwner() {
    setError(null);
    if (
      !(await confirm({
        title: t("common.actions.deleteConfirmTitle"),
        description: t("fleetOwners.detail.deleteConfirm.description"),
        confirmLabel: t("common.actions.delete"),
        destructive: true,
      }))
    ) {
      return;
    }
    const result = await deleteFleetOwner(id);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    // Remove it from the list and from the directory BEFORE navigating, so
    // `/fleet-owners` does not still show a row that no longer exists.
    applyMutationCache(queryClient, ownerImpact({ id }, "remove"), result);
    router.push("/fleet-owners");
  }

  if (fetchError) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {fetchError.message}
      </p>
    );
  }
  if (!owner || isPending) return <DetailPageSkeleton />;

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title truncate">{owner.name || owner.nickname || owner.phoneNumber}</h1>
          <p className="page-description">{owner.nickname}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-md:w-full">
          <span
            className={
              owner.isActive
                ? "rounded-full bg-green-100 px-3 py-1 text-sm text-green-800"
                : "rounded-full bg-slate-200 px-3 py-1 text-sm"
            }
          >
            {owner.isActive ? t("common.status.active") : t("common.status.inactive")}
          </span>
          <Button type="button" variant="secondary" onClick={openEdit}>
            <Pencil className="size-4" aria-hidden="true" /> {t("common.actions.edit")}
          </Button>
        </div>
      </div>
      {error && !editOpen ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel-card p-5 sm:p-6">
          <h2 className="section-title">{t("fleetOwners.detail.sections.account")}</h2>
          {owner.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={owner.picture}
              alt={t("fleetOwners.detail.imageAlt", { ownerName: owner.name })}
              className="mb-3 size-24 rounded-2xl object-cover"
            />
          ) : null}
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[#606060]">{t("common.fields.phone")}</dt>
              <dd dir="ltr" className="min-w-0 truncate">
                {owner.phoneNumber}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#606060]">{t("common.fields.nationalId")}</dt>
              <dd dir="ltr" className="min-w-0 truncate">
                {owner.nationalId ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#606060]">{t("common.fields.role")}</dt>
              <dd className="min-w-0 truncate">{owner.membership?.roleSlug ?? "—"}</dd>
            </div>
          </dl>
        </div>
        <div className="panel-card p-5 sm:p-6">
          <h2 className="section-title">{t("fleetOwners.detail.sections.company")}</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[#606060]">{t("common.fields.owner")}</dt>
              <dd className="min-w-0 truncate">{owner.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#606060]">{t("common.fields.createdAt")}</dt>
              <dd className="min-w-0 truncate">
                {new Date(owner.createdAt).toLocaleDateString("ar-EG")}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <OwnerSections ownerId={id} />

      <Dialog validation={validation}
        open={editOpen}
        onOpenChange={setEditOpen}
        title={t("fleetOwners.detail.editDialog.title")}
        description={t("fleetOwners.detail.editDialog.description")}
        size="lg"
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-2 block font-bold text-[#334454]">
                {t("common.fields.fullName")}
              </span>
              <Input fieldName="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block font-bold text-[#334454]">
                {t("common.fields.nickname")}
              </span>
              <Input fieldName="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block font-bold text-[#334454]">
                {t("common.fields.phoneNumber")}
              </span>
              <Input fieldName="phone"
                dir="ltr"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block font-bold text-[#334454]">
                {t("common.fields.nationalId")}
              </span>
              <Input fieldName="nationalId"
                dir="ltr"
                value={nationalId}
                onChange={(event) => setNationalId(event.target.value)}
                inputMode="numeric"
                maxLength={14}
              />
            </label>
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
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="size-4 accent-[#059ff8]"
            />{" "}
            {t("fleetOwners.detail.editDialog.activeAccountShort")}
          </label>
          {error ? (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
            <Button
              type="button"
              variant="danger"
              onClick={() => void removeOwner()}
              disabled={saving}
            >
              {t("fleetOwners.detail.deleteOwner")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button type="button" variant="success" onClick={() => void save()} loading={saving}>
              {saving ? t("common.loading.saving") : t("common.actions.saveChanges")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
