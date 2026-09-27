"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ImagePicker } from "@/components/ui/image-picker";
import { fetchDriver, updateDriver, MEMBER_STATUS_AR, type DriverRow, type Member } from "@/lib/actions/members";
import { uploadUserPicture } from "@/lib/actions/users";

const REVOKE_WARNING = "الإجراء ده هيقفل جلسات المستخدم فورا — متأكد؟";

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
      setError("الاسم مطلوب.");
      return;
    }
    if (password && password.length < 8) {
      setError("كلمة السر لازم تبقى 8 حروف على الأقل.");
      return;
    }
    if (status !== "ACTIVE" && !(await confirm({ title: "تأكيد الإجراء", description: REVOKE_WARNING, confirmLabel: "تأكيد", destructive: true }))) return;
    setSaving(true);
    const r = await updateDriver(fleetId, driver.id, {
      status,
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      phone: phone.trim() || undefined,
      nationalId: nationalId.trim() || undefined,
      ...(password ? { password } : {}),
    });
    if (!r.ok) {
      setSaving(false);
      setError(r.message);
      return;
    }
    // الصورة الجديدة بتترفع كملف FormData لحساب السواق
    if (imageFile) {
      const uploaded = await uploadUserPicture(driver.userId ?? driver.id, imageFile);
      if (!uploaded.ok) setError(uploaded.message);
    }
    const refreshed = await fetchDriver(fleetId, driver.id);
    setSaving(false);
    if (refreshed.ok) onSaved?.(refreshed.data);
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open && Boolean(driver)} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title="تعديل بيانات السواق" description="حدّث بيانات الحساب كاملة — تغيير كلمة السر هيقفل جلساته الحالية." size="lg">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">الاسم بالكامل<span className="text-[#dc2626]"> *</span></span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="كريم علي" autoComplete="name" />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">اسم الشهرة</span>
          <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="كريم" />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">رقم الموبايل</span>
          <Input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" inputMode="tel" autoComplete="tel" />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">الرقم القومي</span>
          <Input dir="ltr" value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="14 رقم" inputMode="numeric" maxLength={14} />
        </label>
        <ImagePicker
          label="صورة السواق"
          file={imageFile}
          onChange={setImageFile}
          existingUrl={driver?.picture ?? null}
          uploading={saving && Boolean(imageFile)}
          hint="بتترفع كملف (FormData) للتخزين السحابي — من غير روابط."
        />
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">كلمة مرور جديدة <span className="font-normal text-slate-400">(اختياري)</span></span>
          <Input dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="اتركها فاضية من غير تغيير" autoComplete="new-password" />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">حالة العضوية</span>
          <select
            aria-label="حالة السواق"
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
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>إلغاء</Button>
          <AsyncButton type="button" variant="success" onClick={save}>حفظ التعديلات</AsyncButton>
        </div>
      </div>
    </Dialog>
  );
}
