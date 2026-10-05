"use client";

import * as schemas from "@/lib/schemas/p1";

import { schemaErrors } from "@/lib/field-validation";

import { useFieldValidation } from "@/components/ui/field-validation";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ui/image-picker";
import { OwnerPicker } from "@/components/owners/owner-picker";
import { createDriverAccount, type SystemDriverRow } from "@/lib/actions/members";
import { fetchFleetOwner } from "@/lib/actions/fleet-owners";
import { discardUserPicture, stageUserPicture } from "@/lib/actions/users";
import type { StagedUpload } from "@/lib/actions/http";
import { createDriverAccountSchema } from "@/lib/schemas/p1";
import { qk, useApiQuery } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

/**
 * Create a driver account from the platform (super-admin) side.
 *
 * Every created driver is an EMPLOYED driver under one owner company: the
 * searchable owner picker is required. When the dialog is opened from an owner
 * page (`lockedOwnerId`) the company is already decided by where the operator
 * is — the picker is replaced by a locked field showing that owner's name.
 *
 * A staged picture is DISCARDED when the account write fails, so a rejected
 * form does not leave an orphan file in storage.
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
  onCreated?: (driver: SystemDriverRow) => void;
}) {
  // Opened from an owner page: the company is decided by where the operator is.
  const [pickedOwnerId, setPickedOwnerId] = useState(lockedOwnerId ?? "");
  const [ownerLabel, setOwnerLabel] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownerLocked = Boolean(lockedOwnerId);
  const ownerId = lockedOwnerId ?? pickedOwnerId;

  // Locked mode names the company for the operator; the account payload only
  // ever carries its id.
  const { data: lockedOwner } = useApiQuery(
    qk.fleetOwner(lockedOwnerId ?? "none"),
    () => fetchFleetOwner(lockedOwnerId!),
    { enabled: open && ownerLocked },
  );
  const lockedOwnerLabel = lockedOwner?.name || lockedOwner?.nickname || lockedOwner?.phoneNumber || null;

  function resetForm() {
    validation.reset();
    setPickedOwnerId(lockedOwnerId ?? "");
    setOwnerLabel(null);
    setName(""); setNickname(""); setPhone(""); setNationalId("");
    setPassword(""); setPasswordConfirmation(""); setImageFile(null); setError(null);
  }

  const validation = useFieldValidation(() => ({ ...schemaErrors(schemas.createDriverAccountSchema, { ownerId: ownerId || undefined, name: name.trim() || undefined, nickname: nickname.trim() || undefined, phone, password, nationalId: nationalId || undefined }), passwordConfirmation: !passwordConfirmation ? t("validation.required") : password === passwordConfirmation ? undefined : t("common.validation.passwordsMismatch") }));

  async function submit() {
    if (!validation.validate()) return;
    setError(null);

    const parsed = createDriverAccountSchema.safeParse({
      ownerId,
      name: name.trim() || undefined,
      nickname: nickname.trim() || undefined,
      phone,
      password,
      nationalId: nationalId || undefined,
    });
    if (!parsed.success) return;
    setSaving(true);
    // The picture goes straight to cloud storage first — a failed upload must
    // not create an account, and a failed account write discards the image.
    let staged: StagedUpload | null = null;
    if (imageFile) {
      const s = await stageUserPicture(imageFile);
      if (!s.ok) {
        setSaving(false);
        setError(validation.failure(s));
        return;
      }
      staged = s.data;
    }
    const result = await createDriverAccount(
      { ...parsed.data, ...(staged ? { picture: staged.publicUrl } : {}) },
      ownerLabel ?? lockedOwnerLabel ?? undefined,
    );
    if (!result.ok) {
      if (staged) await discardUserPicture(staged);
      setSaving(false);
      setError(validation.failure(result));
      return;
    }
    onCreated?.(result.data);
    setSaving(false);
    resetForm();
    onClose();
  }

  return (
    <Dialog validation={validation}
      open={open}
      onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }}
      title={t("drivers.createDialog.title")}
      description={t("drivers.createDialog.description")}
      size="lg"
    >
      <div>
        {ownerLocked ? (
          <div className="mb-5">
            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">{t("fleetOwnerPicker.label")}</span>
              <Input value={lockedOwnerLabel ?? lockedOwnerId ?? ""} disabled readOnly aria-label={t("fleetOwnerPicker.label")} />
            </label>
            <p className="mt-1.5 text-xs text-[#6b7c8c]">{t("drivers.createDialog.lockedOwnerHint")}</p>
          </div>
        ) : (
          <div className="mb-5">
            <OwnerPicker
              ownerId={pickedOwnerId}
              onOwnerChange={setPickedOwnerId}
              onOwnerResolved={setOwnerLabel}
              allowEmpty={false}
              placeholder={t("drivers.createDialog.ownerRequired")}
            />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.fullName")}</span><Input fieldName="name" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("drivers.placeholders.fullName")} /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.nickname")}</span><Input fieldName="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder={t("drivers.placeholders.nickname")} /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.phoneNumber")}</span><Input fieldName="phone" dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01xxxxxxxxx" /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.nationalIdOptional")}</span><Input fieldName="nationalId" dir="ltr" value={nationalId} onChange={(event) => setNationalId(event.target.value)} placeholder={t("drivers.placeholders.nationalIdDigits")} /></label>
          <ImagePicker
            label={t("drivers.createDialog.imageLabel")}
            file={imageFile}
            onChange={setImageFile}
            uploading={saving && Boolean(imageFile)}
            hint={t("common.image.hintUploadFile")}
          />
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.password")}</span><Input fieldName="password" dir="ltr" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.passwordConfirm")}</span><Input fieldName="passwordConfirmation" dir="ltr" type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} autoComplete="new-password" /></label>
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
