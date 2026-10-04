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
import { discardUserPicture, stageUserPicture } from "@/lib/actions/users";
import type { StagedUpload } from "@/lib/actions/http";
import { createDriverAccountSchema } from "@/lib/schemas/p1";
import { t } from "@/lib/i18n/t";

/**
 * Create a driver account from the platform (super-admin) side.
 *
 * The OPERATOR picks the account shape, which is the whole point of the dialog:
 *
 * - **Independent driver** — the driver is their own company. No company is
 *   chosen, the server anchors the membership on the new user's own id, and the
 *   account gets the `independent_driver` role.
 * - **Under a fleet owner** — the searchable owner picker appears and the driver
 *   is filed inside that company with the `driver` role. When the dialog is
 *   opened from an owner page (`lockedOwnerId`) this mode is selected and
 *   LOCKED: the operator is already inside a company and the driver belongs
 *   there.
 *
 * Switching back to Independent clears the previously chosen owner so a stale
 * `ownerId` can never leak into an independent request (the API rejects it with
 * a 422 anyway — the UI just refuses to send it).
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
  const [mode, setMode] = useState<"INDEPENDENT" | "OWNER">(
    lockedOwnerId ? "OWNER" : "INDEPENDENT",
  );
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
  const needsOwner = mode === "OWNER";

  function resetForm() {
    validation.reset();
    setMode(lockedOwnerId ? "OWNER" : "INDEPENDENT");
    setPickedOwnerId(lockedOwnerId ?? "");
    setOwnerLabel(null);
    setName(""); setNickname(""); setPhone(""); setNationalId("");
    setPassword(""); setPasswordConfirmation(""); setImageFile(null); setError(null);
  }

  function changeMode(next: "INDEPENDENT" | "OWNER") {
    if (mode === next) return;
    setMode(next);
    setError(null);
    if (next === "INDEPENDENT") {
      // An independent driver belongs to no company — drop any earlier choice.
      setPickedOwnerId("");
      setOwnerLabel(null);
    }
  }

  const validation = useFieldValidation(() => ({ ...schemaErrors(schemas.createDriverAccountSchema, { mode, ownerId: needsOwner ? ownerId || undefined : undefined, name: name.trim(), nickname: nickname.trim(), phone, password, nationalId: nationalId || undefined }), passwordConfirmation: !passwordConfirmation ? t("validation.required") : password === passwordConfirmation ? undefined : t("common.validation.passwordsMismatch") }));

  async function submit() {
    if (!validation.validate()) return;
    setError(null);

    const parsed = createDriverAccountSchema.safeParse({
      mode,
      ...(needsOwner && ownerId ? { ownerId } : {}),
      name: name.trim(),
      nickname: nickname.trim(),
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
      ownerLabel ?? undefined,
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
        <fieldset className="mb-5">
          <legend className="mb-1.5 block text-sm font-bold text-[#334454]">
            {t("drivers.createDialog.modeLabel")}
          </legend>
          <div className="grid gap-2 md:grid-cols-2">
            <label
              className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${
                mode === "INDEPENDENT" ? "border-[#1f6f8b] bg-[#f2f8fb]" : "border-[#e4ecf2]"
              }`}
            >
              <input
                type="radio"
                name="driver-mode"
                className="mt-0.5"
                checked={mode === "INDEPENDENT"}
                onChange={() => changeMode("INDEPENDENT")}
              />
              <span>
                <span className="block font-bold text-[#334454]">
                  {t("drivers.createDialog.modeIndependent")}
                </span>
                <span className="block text-xs text-[#6b7c8c]">
                  {t("drivers.createDialog.modeIndependentHint")}
                </span>
              </span>
            </label>
            <label
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                mode === "OWNER" ? "border-[#1f6f8b] bg-[#f2f8fb]" : "border-[#e4ecf2]"
              } ${ownerLocked ? "opacity-80" : "cursor-pointer"}`}
            >
              <input
                type="radio"
                name="driver-mode"
                className="mt-0.5"
                checked={mode === "OWNER"}
                disabled={ownerLocked}
                onChange={() => changeMode("OWNER")}
              />
              <span>
                <span className="block font-bold text-[#334454]">
                  {t("drivers.createDialog.modeOwner")}
                </span>
                <span className="block text-xs text-[#6b7c8c]">
                  {t("drivers.createDialog.modeOwnerHint")}
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        {needsOwner && !ownerLocked ? (
          <div className="mb-5">
            <OwnerPicker
              ownerId={pickedOwnerId}
              onOwnerChange={setPickedOwnerId}
              onOwnerResolved={setOwnerLabel}
              allowEmpty={false}
              placeholder={t("drivers.createDialog.ownerRequired")}
            />
          </div>
        ) : null}

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
