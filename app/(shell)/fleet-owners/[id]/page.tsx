"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fetchFleetOwner, updateFleetOwner, type FleetOwnerAccount } from "@/lib/actions/fleet-owners";
import { updateFleetOwnerSchema } from "@/lib/schemas/p1";
import { Pencil } from "lucide-react";

export default function FleetOwnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [owner, setOwner] = useState<FleetOwnerAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [picture, setPicture] = useState("");
  const [isActive, setIsActive] = useState(true);
  useEffect(() => {
    fetchFleetOwner(id).then((result) => result.ok ? setOwner(result.data) : setError(result.message));
  }, [id]);

  function openEdit() {
    if (!owner) return;
    setName(owner.name ?? "");
    setNickname(owner.nickname ?? "");
    setPhone(owner.phoneNumber ?? "");
    setNationalId(owner.nationalId ?? "");
    setPicture(owner.picture ?? "");
    setIsActive(owner.isActive);
    setError(null);
    setEditOpen(true);
  }

  async function save() {
    const parsed = updateFleetOwnerSchema.safeParse({ name, nickname, phone, nationalId, picture, isActive });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "راجع البيانات المدخلة");
      return;
    }
    setSaving(true);
    setError(null);
    setNote(null);
    const result = await updateFleetOwner(id, parsed.data);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOwner(result.data);
    setNote("اتحفظت بيانات مالك الأسطول");
    setEditOpen(false);
  }
  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!owner) return <p className="text-sm text-[#606060]">جاري التحميل…</p>;
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
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-[#606060]">الموبايل</dt><dd dir="ltr">{owner.phoneNumber}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[#606060]">الرقم القومي</dt><dd dir="ltr">{owner.nationalId ?? "—"}</dd></div>
          </dl>
        </section>
        <section className="panel-card p-5 sm:p-6">
          <h2 className="section-title">الأساطيل</h2>
          <div className="space-y-2">{owner.fleets.map((fleet) => <Link key={fleet.id} href={`/fleets/${fleet.id}`} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 hover:bg-[#daeaf5]"><span>{fleet.name}</span><span className="text-sm text-[#606060]">{fleet.isActive ? "نشط" : "موقوف"}</span></Link>)}</div>
          <Button asChild variant="secondary" className="mt-4 w-full sm:w-auto"><Link href="/buses/new">إضافة أتوبيس</Link></Button>
        </section>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="تعديل مالك الأسطول" description="حدّث بيانات الحساب وحالته. إيقاف الحساب يقفل جلساته الحالية." size="lg">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">الاسم بالكامل</span><Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
            <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">اسم الشهرة</span><Input value={nickname} onChange={(event) => setNickname(event.target.value)} /></label>
            <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">رقم الموبايل</span><Input dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" /></label>
            <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">الرقم القومي</span><Input dir="ltr" value={nationalId} onChange={(event) => setNationalId(event.target.value)} inputMode="numeric" maxLength={14} /></label>
            <label className="block text-sm sm:col-span-2"><span className="mb-2 block font-bold text-[#334454]">رابط الصورة (اختياري)</span><Input dir="ltr" value={picture} onChange={(event) => setPicture(event.target.value)} inputMode="url" /></label>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-[#d8e4ec] bg-[#f8fbfd] p-4 text-sm font-bold text-[#334454]">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="size-4 accent-[#2f719e]" /> الحساب نشط
          </label>
          {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-[#e4ecf2] pt-4">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)} disabled={saving}>إلغاء</Button>
            <Button type="button" onClick={save} disabled={saving}>{saving ? "جاري الحفظ…" : "حفظ التعديلات"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
