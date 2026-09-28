"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ImagePicker } from "@/components/ui/image-picker";
import { fetchDriver, updateDriver, MEMBER_STATUS_AR, type DriverRow, type Member } from "@/lib/actions/members";
import { discardUserPicture, stageUserPicture } from "@/lib/actions/users";
import type { StagedUpload } from "@/lib/actions/http";
import { t } from "@/lib/i18n/t";

const REVOKE_WARNING = t("common.confirm.revokeSessions");

/**
 * نافذة تعديل بيانات السواق — مشتركة بين صفحة السواقين وصفحة التفاصيل.
 * الحفظ بيعمل refresh للصف من السيرفر ويرجّعه في onSaved علشان كل شاشة
 * تحدّث الكاش بتاعها بنفسها.
 */
export function EditDriverDialog({
  open,
  driver,
  onClose,
  onSaved,
}: {
  open: boolean;
  driver: (DriverRow & { fleet: { id: string } }) | null;
  onClose: () => void;
  onSaved?: (fresh: DriverRow) => void;
}) {
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Member["status"]>("ACTIVE");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (driver && driver.id !== loadedFor) {
    setLoadedFor(driver.id);
    setName(driver.name ?? "");
    setNickname(driver.nickname ?? "");
    setPhone(driver.phoneNumber ?? "");
    setNationalId(driver.nationalId ?? "");
    setPassword("");
    setStatus(driver.status === "SUSPENDED" || driver.status === "REVOKED" ? driver.status : "ACTIVE");
    setImageFile(null);
    setError(null);
  }

  function resetForm() {
    setLoadedFor(null);
    setImageFile(null);
    setError(null);
  }

  async function save() {
    if (!driver) return;
    const fleetId = driver.fleet.id;
    setError(null);
    if (name.trim() === "") {
      setError(t("drivers.editDialog.errors.nameRequired"));
      return;
    }
    if (password && password.length < 8) {
      setError(t("drivers.editDialog.errors.passwordMin"));
      return;
    }
    if (status !== "ACTIVE" && !(await confirm({ title: t("common.actions.confirmAction"), description: REVOKE_WARNING, confirmLabel: t("common.actions.confirm"), destructive: true }))) return;
    setSaving(true);
    // الصورة بتترفع الأول مباشر للتخزين السحابي، وبعدين الحفظ بيتم في طلب
    // واحد — لو الرفع فشل مفيش تعديل يتطبق، ولو الحفظ فشل بنمسح المرحلية.
    let staged: StagedUpload | null = null;
    if (imageFile) {
      const s = await stageUserPicture(imageFile, driver.userId ?? driver.id);
      if (!s.ok) {
        setSaving(false);
        setError(s.message);
        return;
      }
      staged = s.data;
    }
    const r = await updateDriver(fleetId, driver.id, {
      status,
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      phone: phone.trim() || undefined,
      nationalId: nationalId.trim() || undefined,
      ...(password ? { password } : {}),
      ...(staged ? { picture: staged.publicUrl } : {}),
    });
    if (!r.ok) {
      if (staged) await discardUserPicture(staged);
      setSaving(false);
      setError(r.message);
      return;
    }
    const refreshed = await fetchDriver(fleetId, driver.id);
    setSaving(false);
    if (refreshed.ok) onSaved?.(refreshed.data);
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open && Boolean(driver)} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title={t("drivers.editDialog.title")} description={t("drivers.editDialog.description")} size="lg">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.fullName")}<span className="text-[#dc2626]"> *</span></span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("drivers.placeholders.fullName")} autoComplete="name" />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.nickname")}</span>
          <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t("drivers.placeholders.nickname")} />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.phoneNumber")}</span>
          <Input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" inputMode="tel" autoComplete="tel" />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.nationalId")}</span>
          <Input dir="ltr" value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder={t("drivers.placeholders.nationalIdDigits")} inputMode="numeric" maxLength={14} />
        </label>
        <ImagePicker
          label={t("drivers.editDialog.imageLabel")}
          file={imageFile}
          onChange={setImageFile}
          existingUrl={driver?.picture ?? null}
          uploading={saving && Boolean(imageFile)}
          hint={t("common.image.hintUploadFormData")}
        />
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("drivers.editDialog.newPasswordLabel")} <span className="font-normal text-slate-400">{t("common.value.optional")}</span></span>
          <Input dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("drivers.placeholders.keepPasswordEmpty")} autoComplete="new-password" />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("drivers.editDialog.membershipStatus")}</span>
          <select
            aria-label={t("drivers.editDialog.membershipStatusAria")}
            value={status}
            onChange={(e) => setStatus(e.target.value as Member["status"])}
            className="select-field w-full"
          >
            {(Object.keys(MEMBER_STATUS_AR) as Member["status"][]).map((s) => (
              <option key={s} value={s}>{MEMBER_STATUS_AR[s]}</option>
            ))}
          </select>
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 md:col-span-2">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end md:col-span-2">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>{t("common.actions.cancel")}</Button>
          <AsyncButton type="button" variant="success" onClick={save}>{t("common.actions.saveChanges")}</AsyncButton>
        </div>
      </div>
    </Dialog>
  );
}
