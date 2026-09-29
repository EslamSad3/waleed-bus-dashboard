"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ui/image-picker";
import { OwnerPicker } from "@/components/owners/owner-picker";
import { fetchSystemDriversPage, inviteDriver, type DriverRow, type SystemDriverRow } from "@/lib/actions/members";
import { discardUserPicture, stageUserPicture } from "@/lib/actions/users";
import type { StagedUpload } from "@/lib/actions/http";
import { driverFreshSchema } from "@/lib/schemas/p1";
import { qk, upsertInCursorList, useQueryClient } from "@/lib/queries";
import type { CursorPage } from "@/lib/actions/http";
import { t } from "@/lib/i18n/t";

/**
 * Invite a driver into a company. Shared by the cross-owner drivers screen and
 * the owner's own roster tab, so `lockedOwnerId` pins the company and hides the
 * picker there.
 *
 * `onCreated` is how a caller with its own list refreshes it; the cross-owner
 * cache is still updated inline for the shared case.
 */
export function CreateDriverDialog({
  open,
  onClose,
  lockedOwnerId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  lockedOwnerId?: string;
  onCreated?: (driver: DriverRow) => void;
}) {
  const queryClient = useQueryClient();
  const [pickedOwnerId, setPickedOwnerId] = useState("");
  const ownerId = lockedOwnerId ?? pickedOwnerId;
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
    setPickedOwnerId(""); setName(""); setNickname(""); setPhone(""); setNationalId("");
    setPassword(""); setPasswordConfirmation(""); setImageFile(null); setError(null);
  }

  async function submit() {
    setError(null);
    if (!ownerId) {
      setError(t("drivers.errors.pickOwner"));
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
    const result = await inviteDriver(ownerId, {
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
    onCreated?.(result.data);
    const refreshed = await fetchSystemDriversPage(null);
    if (refreshed.ok) queryClient.setQueryData<CursorPage<SystemDriverRow>>(qk.drivers, refreshed.data);
    else {
      upsertInCursorList<SystemDriverRow>(queryClient, qk.drivers, {
        ...result.data,
        owner: { id: ownerId, name: "", phoneNumber: null },
        assignedBus: null,
      } as SystemDriverRow);
    }
    setSaving(false);
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title={t("drivers.createDialog.title")} description={t("drivers.createDialog.description")} size="lg">
      <div>
        {lockedOwnerId ? null : <div className="mb-5"><OwnerPicker ownerId={pickedOwnerId} onOwnerChange={setPickedOwnerId} /></div>}
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
