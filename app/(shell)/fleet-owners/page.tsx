"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ui/image-picker";
import { TableSkeleton } from "@/components/ui/skeletons";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  createFleetOwner,
  deleteFleetOwner,
  discardFleetOwnerPicture,
  fetchFleetOwnersPage,
  stageFleetOwnerPicture,
  updateFleetOwner,
  type FleetOwnerAccount,
} from "@/lib/actions/fleet-owners";
import type { StagedUpload } from "@/lib/actions/http";
import { createFleet } from "@/lib/actions/fleets";
import { createFleetOwnerSchema } from "@/lib/schemas/p1";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

type Page = { items: FleetOwnerAccount[]; nextCursor: string | null };

/** صياغة عدد الشركات بالعربي المصري (شركة واحدة / شركتين / 3 شركات / 11 شركة). */
function fleetCountLabel(count: number): string {
  if (count === 1) return t("fleetOwners.count.one");
  if (count === 2) return t("fleetOwners.count.two");
  if (count <= 10) return t("fleetOwners.count.few", { count });
  return t("fleetOwners.count.many", { count });
}

/** نافذة إضافة صاحب عربية — الصورة بتترفع كملف (FormData) مش لينك. */
function CreateFleetOwnerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [fleetName, setFleetName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName(""); setNickname(""); setPhone(""); setNationalId(""); setFleetName("");
    setPassword(""); setPasswordConfirmation(""); setImageFile(null);
    setError(null);
  }

  async function submit() {
    setError(null);
    const parsed = createFleetOwnerSchema.safeParse({
      name, nickname, phone, fleetName,
      password,
      nationalId: nationalId || undefined,
      picture: undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("common.validation.required"));
      return;
    }
    if (password !== passwordConfirmation) {
      setError(t("common.validation.passwordsMismatch"));
      return;
    }
    setSaving(true);
    // الصورة بتترفع الأول (مباشر للتخزين السحابي) قبل إنشاء الحساب — لو الرفع
    // فشل مفيش سجل يتيم، ولو الإنشاء فشل بنمسح الصورة المرحلية.
    let staged: StagedUpload | null = null;
    if (imageFile) {
      const s = await stageFleetOwnerPicture(imageFile);
      if (!s.ok) {
        setSaving(false);
        setError(s.message);
        return;
      }
      staged = s.data;
    }
    const result = await createFleetOwner({
      name: name.trim(),
      nickname: nickname.trim(),
      phone,
      password,
      fleetName: fleetName.trim(),
      nationalId: nationalId || undefined,
      ...(staged ? { picture: staged.publicUrl } : {}),
    });
    if (!result.ok) {
      if (staged) await discardFleetOwnerPicture(staged);
      setSaving(false);
      setError(result.message);
      return;
    }
    setSaving(false);
    const refreshed = await fetchFleetOwnersPage(null);
    if (refreshed.ok) queryClient.setQueryData<Page>(qk.fleetOwners, refreshed.data);
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title={t("fleetOwners.createDialog.title")} description={t("fleetOwners.createDialog.description")} size="lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.fullName")}</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("fleetOwners.placeholders.fullName")} autoComplete="name" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.nickname")}</span><Input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder={t("fleetOwners.placeholders.nickname")} autoComplete="off" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.phoneNumber")}</span><Input dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01xxxxxxxxx" autoComplete="tel" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.nationalIdOptional")}</span><Input dir="ltr" value={nationalId} onChange={(event) => setNationalId(event.target.value)} placeholder={t("fleetOwners.placeholders.nationalIdDigits")} autoComplete="off" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.fleetName")}</span><Input value={fleetName} onChange={(event) => setFleetName(event.target.value)} placeholder={t("fleetOwners.placeholders.fleetName")} autoComplete="organization" /></label>
        <ImagePicker
          label={t("fleetOwners.createDialog.imageLabel")}
          file={imageFile}
          onChange={setImageFile}
          uploading={saving && Boolean(imageFile)}
          hint={t("common.image.hintUploadFile")}
        />
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.password")}</span><Input dir="ltr" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.passwordConfirm")}</span><Input dir="ltr" type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} autoComplete="new-password" /></label>
        {error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:col-span-2">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>{t("common.actions.cancel")}</Button>
          <Button type="button" variant="success" onClick={() => void submit()} loading={saving}>{saving ? t("common.loading.creating") : t("fleetOwners.createDialog.submit")}</Button>
        </div>
      </div>
    </Dialog>
  );
}

/** نافذة تعديل بيانات صاحب عربية — نفس شكل الإضافة من غير كلمة السر والأسطول. */
function EditFleetOwnerDialog({ open, owner, onClose }: { open: boolean; owner: FleetOwnerAccount | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // املأ الحقول من المالك المختار — بالنسبة للـ id نفسه مرة واحدة بس
  if (owner && owner.id !== loadedFor) {
    setLoadedFor(owner.id);
    setName(owner.name ?? "");
    setNickname(owner.nickname ?? "");
    setPhone(owner.phoneNumber ?? "");
    setNationalId(owner.nationalId ?? "");
    setIsActive(owner.isActive);
    setImageFile(null);
    setError(null);
  }

  function resetForm() {
    setLoadedFor(null);
    setImageFile(null);
    setError(null);
  }

  async function submit() {
    if (!owner) return;
    setError(null);
    if (!name.trim()) {
      setError(t("fleetOwners.errors.nameRequired"));
      return;
    }
    if (nationalId && !/^\d{14}$/.test(nationalId.trim())) {
      setError(t("common.validation.nationalIdDigits"));
      return;
    }
    setSaving(true);
    // الصورة بتترفع الأول مباشر للتخزين السحابي — لو الرفع فشل مفيش تعديل
    // يتطبق، ولو الحفظ فشل بنمسح الصورة المرحلية.
    let staged: StagedUpload | null = null;
    if (imageFile) {
      const s = await stageFleetOwnerPicture(imageFile, owner.id);
      if (!s.ok) {
        setSaving(false);
        setError(s.message);
        return;
      }
      staged = s.data;
    }
    const result = await updateFleetOwner(owner.id, {
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      phone: phone.trim() || undefined,
      nationalId: nationalId.trim() || "",
      isActive,
      ...(staged ? { picture: staged.publicUrl } : {}),
    });
    if (!result.ok) {
      if (staged) await discardFleetOwnerPicture(staged);
      setSaving(false);
      setError(result.message);
      return;
    }
    setSaving(false);
    const refreshed = await fetchFleetOwnersPage(null);
    if (refreshed.ok) queryClient.setQueryData<Page>(qk.fleetOwners, refreshed.data);
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open && Boolean(owner)} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title={t("fleetOwners.editDialog.title")} description={owner ? t("fleetOwners.editDialog.description", { value: owner.name ?? owner.phoneNumber }) : undefined} size="lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.fullName")}</span><Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.nickname")}</span><Input value={nickname} onChange={(event) => setNickname(event.target.value)} autoComplete="off" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.phoneNumber")}</span><Input dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.nationalIdOptional")}</span><Input dir="ltr" value={nationalId} onChange={(event) => setNationalId(event.target.value)} placeholder={t("fleetOwners.placeholders.nationalIdDigits")} autoComplete="off" /></label>
        <label className="flex items-center gap-2 rounded-xl bg-[#f8fbfd] p-3 text-sm"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="size-4 accent-[#059ff8]" /> {t("fleetOwners.editDialog.activeAccount")}</label>
        <ImagePicker
          label={t("fleetOwners.editDialog.imageLabel")}
          file={imageFile}
          onChange={setImageFile}
          uploading={saving && Boolean(imageFile)}
          hint={t("common.image.hintUploadFile")}
        />
        {error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:col-span-2">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>{t("common.actions.cancel")}</Button>
          <Button type="button" variant="success" onClick={() => void submit()} loading={saving}>{saving ? t("common.loading.saving") : t("common.actions.saveChanges")}</Button>
        </div>
      </div>
    </Dialog>
  );
}

/** نافذة إضافة أسطول لصاحب عربية موجود (issue 13). */
function AddFleetToOwnerDialog({ open, owner, onClose }: { open: boolean; owner: FleetOwnerAccount | null; onClose: () => void }) {
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
    const result = await createFleet({ name: fleetName.trim(), ownerId: owner.id, ownerRoleSlug: "fleet-owner" });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const refreshed = await fetchFleetOwnersPage(null);
    if (refreshed.ok) queryClient.setQueryData<Page>(qk.fleetOwners, refreshed.data);
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

export default function FleetOwnersPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const [fleetOwnerForFleet, setFleetOwnerForFleet] = useState<FleetOwnerAccount | null>(null);
  const [ownerForEdit, setOwnerForEdit] = useState<FleetOwnerAccount | null>(null);
  const [query, setQuery] = useState("");

  const { data: page, isPending, error } = useApiQuery<Page>(qk.fleetOwners, () => fetchFleetOwnersPage(null));

  async function refresh() {
    const refreshed = await fetchFleetOwnersPage(null);
    if (refreshed.ok) queryClient.setQueryData<Page>(qk.fleetOwners, refreshed.data);
  }

  async function removeOwner(owner: FleetOwnerAccount) {
    const fleetsNote = owner.fleets.length > 0 ? t("fleetOwners.deleteConfirm.ownsNote", { value: owner.fleets.length }) : "";
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("fleetOwners.deleteConfirm.description", { value: owner.name ?? owner.phoneNumber, fleetsNote: fleetsNote }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteFleetOwner(owner.id);
    if (!result.ok) return;
    await refresh();
  }

  const term = query.trim().toLocaleLowerCase("ar-EG");
  const filter = (owner: FleetOwnerAccount) =>
    !term || [owner.name, owner.nickname, owner.phoneNumber, ...owner.fleets.map((fleet) => fleet.name)]
      .some((value) => value?.toLocaleLowerCase("ar-EG").includes(term));

  const columns: CommunityColumnDef<FleetOwnerAccount>[] = [
    {
      field: "name",
      headerName: t("common.fields.name"),
      filter: "agTextColumnFilter",
      cellRenderer: (params: { data?: FleetOwnerAccount }) => params.data ? <span className="font-bold">{params.data.name ?? t("common.value.withoutName")}<span className={params.data.isActive ? "ms-2 status-pill" : "ms-2 status-pill status-pill-muted"}>{params.data.isActive ? t("common.status.active") : t("common.status.inactive")}</span></span> : null,
    },
    { field: "phoneNumber", headerName: t("common.fields.phone"), filter: "agTextColumnFilter", valueFormatter: (params) => params.value || "—" },
    { headerName: t("common.fields.firstFleet"), filter: false, valueGetter: (params) => params.data?.fleets?.[0]?.name ?? t("common.value.noFleet") },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("fleetOwners.title")}</h1>
          <p className="page-description">{t("fleetOwners.description")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>{t("fleetOwners.newOwner")}</Button>
      </div>

      {error ? <p role="alert" className="text-sm text-red-600">{error.message}</p> : isPending ? (
        <TableSkeleton rows={8} columns={4} />
      ) : (
        <CursorList<FleetOwnerAccount>
          gridId="fleet-owners"
          initialItems={page?.items ?? []}
          initialCursor={page?.nextCursor ?? null}
          loadMore={(cursor) => fetchFleetOwnersPage(cursor).then((result) => {
            if (!result.ok) throw new Error(result.message);
            return result.data;
          })}
          keyOf={(owner) => owner.id}
          filter={filter}
          columnDefs={columns}
          filterBar={<Input aria-label={t("fleetOwners.filters.searchAria")} placeholder={t("fleetOwners.filters.searchPlaceholder")} value={query} onChange={(event) => setQuery(event.target.value)} className="w-full md:w-auto md:max-w-72 md:min-w-0 md:basis-64 md:flex-1 bg-white" />}
          emptyMessage={t("fleetOwners.empty")}
          renderItem={(owner) => (
            <RowActionsMenu
              label={t("fleetOwners.list.rowActions", { value: owner.name ?? owner.phoneNumber ?? "" })}
              actions={[
                { label: t("common.actions.openDetails"), href: `/fleet-owners/${owner.id}` },
                { label: t("common.actions.edit"), onSelect: () => setOwnerForEdit(owner) },
                { label: t("fleetOwners.actions.addFleet"), onSelect: () => setFleetOwnerForFleet(owner) },
                { label: t("common.actions.delete"), danger: true, onSelect: () => void removeOwner(owner) },
              ]}
            />
          )}
        />
      )}
      <CreateFleetOwnerDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <AddFleetToOwnerDialog open={Boolean(fleetOwnerForFleet)} owner={fleetOwnerForFleet} onClose={() => setFleetOwnerForFleet(null)} />
      <EditFleetOwnerDialog open={Boolean(ownerForEdit)} owner={ownerForEdit} onClose={() => setOwnerForEdit(null)} />
    </div>
  );
}
