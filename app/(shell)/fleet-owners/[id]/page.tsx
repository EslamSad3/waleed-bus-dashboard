"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ui/image-picker";
import { fetchFleetOwner, updateFleetOwner, uploadFleetOwnerPicture, type FleetOwnerAccount } from "@/lib/actions/fleet-owners";
import { updateFleetOwnerSchema } from "@/lib/schemas/p1";
import { qk, patchDetail, useApiQuery, useQueryClient } from "@/lib/queries";
import { Pencil } from "lucide-react";

export default function FleetOwnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: owner, isLoading, error: fetchError } = useApiQuery<FleetOwnerAccount>(qk.fleetOwner(id), () => fetchFleetOwner(id));
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
      setError(parsed.error.issues[0]?.message ?? "راجع البيانات المدخلة");
      return;
    }
    setSaving(true);
    setError(null);
    setNote(null);
    const result = await updateFleetOwner(id, parsed.data);
    if (!result.ok) {
      setSaving(false);
      setError(result.message);
      return;
    }
    // الصورة الجديدة بتترفع كملف FormData — من غير روابط مكتوبة بالإيد.
    if (imageFile) {
      // The update toast already fired — the picture step stays silent.
      const uploaded = await uploadFleetOwnerPicture(id, imageFile, { notify: false });
      if (!uploaded.ok) setError(uploaded.message);
    }
    const refreshed = await fetchFleetOwner(id);
    if (refreshed.ok) patchDetail(queryClient, qk.fleetOwner(id), refreshed.data);
    setSaving(false);
    setNote("اتحفظت بيانات صاحب العربية");
    setEditOpen(false);
  }

  if (fetchError) return <p role="alert" className="text-sm text-red-600">{fetchError.message}</p>;
  if (!owner || isLoading) return <p className="text-sm text-[#606060]">جاري التحميل…</p>;
  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div><h1 className="page-title">{owner.name}</h1><p className="page-description">{owner.nickname}</p></div>
        <div className="flex items-center gap-2">
          <span className={owner.isActive ? "rounded-full bg-green-100 px-3 py-1 text-sm text-green-800" : "rounded-full bg-slate-200 px-3 py-1 text-sm"}>{owner.isActive ? "نشط" : "موقوف"}</span>
          <Button type="button" variant="secondary" onClick={openEdit}><Pencil className="size-4" aria-hidden="true" /> تعديل</Button>
        </div>
      </div>
      {error && !editOpen ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {note ? <p role="status" className="text-sm text-green-700">{note}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel-card p-5 sm:p-6">
          <h2 className="section-title">بيانات الحساب</h2>
          {owner.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={owner.picture} alt={`صورة ${owner.name}`} className="mb-3 size-24 rounded-2xl object-cover" />
          ) : null}
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-[#606060]">الموبايل</dt><dd dir="ltr">{owner.phoneNumber}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[#606060]">الرقم القومي</dt><dd dir="ltr">{owner.nationalId ?? "—"}</dd></div>
          </dl>
        </section>
        <section className="panel-card p-5 sm:p-6">
          <h2 className="section-title">الأساطيل</h2>
          <div className="space-y-2">{owner.fleets.map((fleet) => <Link key={fleet.id} href={`/fleets/${fleet.id}`} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 hover:bg-[#d6eeff]"><span>{fleet.name}</span><span className="text-sm text-[#606060]">{fleet.isActive ? "نشط" : "موقوف"}</span></Link>)}</div>
          <Button asChild variant="secondary" className="mt-4 w-full sm:w-auto"><Link href="/fleets">إضافة أسطول</Link></Button>
        </section>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="تعديل صاحب العربية" description="حدّث بيانات الحساب وحالته. إيقاف الحساب يقفل جلساته الحالية." size="lg">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">الاسم بالكامل</span><Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
            <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">اسم الشهرة</span><Input value={nickname} onChange={(event) => setNickname(event.target.value)} /></label>
            <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">رقم الموبايل</span><Input dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" /></label>
            <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">الرقم القومي</span><Input dir="ltr" value={nationalId} onChange={(event) => setNationalId(event.target.value)} inputMode="numeric" maxLength={14} /></label>
            <div className="sm:col-span-2">
              <ImagePicker
                label="صورة المالك (اختياري)"
                file={imageFile}
                onChange={setImageFile}
                existingUrl={owner?.picture ?? null}
                uploading={saving && Boolean(imageFile)}
                hint="بتترفع كملف للتخزين السحابي — من غير روابط."
              />
            </div>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-[#d8e4ec] bg-[#f8fbfd] p-4 text-sm font-bold text-[#334454]">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="size-4 accent-[#059ff8]" /> الحساب نشط
          </label>
          {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-[#e4ecf2] pt-4">
            <Button type="button" variant="danger" onClick={() => setEditOpen(false)} disabled={saving}>إلغاء</Button>
            <Button type="button" variant="success" onClick={save} loading={saving}>{saving ? "جاري الحفظ…" : "حفظ التعديلات"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
