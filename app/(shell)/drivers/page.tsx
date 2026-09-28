"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ui/image-picker";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { RowActions } from "@/components/ui/row-actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { TableSkeleton } from "@/components/ui/skeletons";
import { FleetOwnerFleetPicker } from "@/components/fleet-owner-fleet-picker";
import { fetchSystemDriversPage, inviteDriver, removeDriver, MEMBER_STATUS_AR, type DriverRow, type SystemDriverRow } from "@/lib/actions/members";
import { discardUserPicture, stageUserPicture } from "@/lib/actions/users";
import type { StagedUpload } from "@/lib/actions/http";
import { driverFreshSchema } from "@/lib/schemas/p1";
import { qk, removeFromCursorList, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";
import { EditDriverDialog } from "@/components/drivers/edit-driver-dialog";
import { t } from "@/lib/i18n/t";

type DriverPage = { items: SystemDriverRow[]; nextCursor: string | null };

/** نافذة إضافة سواق — الصورة بتترفع كملف (FormData) مش لينك. */
function CreateDriverDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [fleetId, setFleetId] = useState("");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setFleetId(""); setName(""); setNickname(""); setPhone(""); setNationalId("");
    setPassword(""); setPasswordConfirmation(""); setImageFile(null); setError(null);
  }

  async function submit() {
    setError(null);
    if (!fleetId) {
      setError(t("drivers.errors.pickOwnerAndFleet"));
      return;
    }
    if (password !== passwordConfirmation) {
      setError(t("common.validation.passwordsMismatch"));
      return;
    }
    const parsed = driverFreshSchema.safeParse({
      name: name.trim(),
      nickname: nickname.trim(),
      phone,
      password,
      nationalId: nationalId || undefined,
      picture: undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("common.validation.required"));
      return;
    }
    setSaving(true);
    // الصورة بتترفع الأول مباشر للتخزين السحابي قبل الدعوة — لو الرفع فشل
    // مفيش حساب يتعمل، ولو الدعوة فشلت بنمسح الصورة المرحلية.
    let staged: StagedUpload | null = null;
    if (imageFile) {
      const s = await stageUserPicture(imageFile);
      if (!s.ok) {
        setSaving(false);
        setError(s.message);
        return;
      }
      staged = s.data;
    }
    const result = await inviteDriver(fleetId, {
      name: name.trim(),
      nickname: nickname.trim(),
      phone,
      password,
      nationalId: nationalId || undefined,
      ...(staged ? { picture: staged.publicUrl } : {}),
    });
    if (!result.ok) {
      if (staged) await discardUserPicture(staged);
      setSaving(false);
      setError(result.message);
      return;
    }
    const refreshed = await fetchSystemDriversPage(null);
    if (refreshed.ok) queryClient.setQueryData<DriverPage>(qk.drivers, refreshed.data);
    else upsertInCursorList<SystemDriverRow>(queryClient, qk.drivers, { ...result.data, fleet: { id: fleetId, name: "" }, fleetOwner: { id: "", name: null, phoneNumber: null }, assignedBus: null });
    setSaving(false);
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title={t("drivers.createDialog.title")} description={t("drivers.createDialog.description")} size="lg">
      <div>
        <div className="mb-5"><FleetOwnerFleetPicker fleetId={fleetId} onFleetChange={setFleetId} /></div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.fullName")}</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("drivers.placeholders.fullName")} /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.nickname")}</span><Input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder={t("drivers.placeholders.nickname")} /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.phoneNumber")}</span><Input dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01xxxxxxxxx" /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.nationalIdOptional")}</span><Input dir="ltr" value={nationalId} onChange={(event) => setNationalId(event.target.value)} placeholder={t("drivers.placeholders.nationalIdDigits")} /></label>
          <ImagePicker
            label={t("drivers.createDialog.imageLabel")}
            file={imageFile}
            onChange={setImageFile}
            uploading={saving && Boolean(imageFile)}
            hint={t("common.image.hintUploadFile")}
          />
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.password")}</span><Input dir="ltr" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.passwordConfirm")}</span><Input dir="ltr" type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} autoComplete="new-password" /></label>
          {error && <p role="alert" className="text-sm text-red-600 md:col-span-2">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row md:col-span-2">
            <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>{t("common.actions.cancel")}</Button>
            <Button type="button" variant="success" onClick={() => void submit()} loading={saving}>{saving ? t("common.loading.creating") : t("drivers.createDialog.submit")}</Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

export default function DriversPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const [driverForEdit, setDriverForEdit] = useState<SystemDriverRow | null>(null);
  const { data: page, isLoading, error } = useApiQuery<DriverPage>(qk.drivers, () => fetchSystemDriversPage(null));
  const drivers = page?.items ?? [];

  async function removeDriverRow(driver: SystemDriverRow) {
    const label = driver.name || driver.nickname || driver.phoneNumber || t("drivers.list.rowLabel");
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("drivers.list.deleteConfirm.description", { label: label, value: driver.fleet.name }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await removeDriver(driver.fleet.id, driver.id);
    if (!result.ok) return;
    removeFromCursorList<SystemDriverRow>(queryClient, qk.drivers, driver.id);
  }

  // بعد الحفظ من نافذة التعديل — الـ row المحدث يوصل الكاش فورًا من غير رفريش
  function onDriverSaved(fresh: DriverRow) {
    upsertInCursorList<SystemDriverRow>(queryClient, qk.drivers, { ...driverForEdit, ...fresh } as SystemDriverRow);
  }

  const columns: CommunityColumnDef<SystemDriverRow>[] = [
    { field: "name", headerName: t("common.fields.driver"), filter: "agTextColumnFilter", valueFormatter: (params) => params.value || t("common.value.withoutName") },
    { field: "phoneNumber", headerName: t("common.fields.phone"), filter: "agTextColumnFilter" },
    { field: "fleet.name", headerName: t("common.fields.fleet"), valueGetter: (params) => params.data?.fleet.name },
    { field: "fleetOwner.name", headerName: t("common.fields.fleetOwner"), valueGetter: (params) => params.data?.fleetOwner.name || t("common.value.withoutName") },
    { field: "assignedBus.registrationNumber", headerName: t("drivers.columns.assignedBus"), valueGetter: (params) => params.data?.assignedBus?.registrationNumber || t("drivers.list.notAssigned") },
    {
      field: "status",
      headerName: t("common.fields.status"),
      filter: "agTextColumnFilter",
      valueFormatter: (params) => MEMBER_STATUS_AR[params.value as keyof typeof MEMBER_STATUS_AR] ?? params.value,
    },
];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0">
          <h1 className="page-title">{t("drivers.title")}</h1>
          <p className="page-description">{t("drivers.description")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>{t("drivers.newDriver")}</Button>
      </div>

      {error ? <p role="alert" className="text-sm text-red-600">{error.message}</p> : null}
      {isLoading ? (
        <TableSkeleton rows={8} columns={7} />
      ) : (
        <CursorList<SystemDriverRow>
          gridId="drivers"
          initialItems={drivers}
          initialCursor={page?.nextCursor ?? null}
          loadMore={async (cursor) => {
            const result = await fetchSystemDriversPage(cursor);
            if (!result.ok) throw new Error(result.message);
            return result.data;
          }}
          keyOf={(driver) => driver.id}
          columnDefs={columns}
          emptyMessage={t("drivers.empty")}
          renderItem={(driver) => (
            <RowActions
              label={t("drivers.list.rowActions", { value: driver.name || driver.nickname || driver.phoneNumber || "" })}
              actions={[
                { label: t("common.actions.openDetails"), icon: Eye, href: `/drivers/${driver.id}?fleetId=${driver.fleet.id}` },
                { label: t("common.actions.edit"), icon: Pencil, onSelect: () => setDriverForEdit(driver) },
                { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void removeDriverRow(driver) },
              ]}
            />
          )}
        />
      )}
      <CreateDriverDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditDriverDialog
        open={Boolean(driverForEdit)}
        driver={driverForEdit}
        onClose={() => setDriverForEdit(null)}
        onSaved={onDriverSaved}
      />
    </div>
  );
}
