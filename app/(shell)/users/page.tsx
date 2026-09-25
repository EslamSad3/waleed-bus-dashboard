"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CursorList } from "@/components/tables/cursor-list";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fetchRolesPage, type Role } from "@/lib/actions/roles";
import { PLATFORM_DEFAULT_MAX_BOOKING_SEATS, createAdminUser, deleteAdminUser, fetchAdminUser, fetchAdminUsers, setAdminUserRoles, updateAdminUser, type AdminUser } from "@/lib/actions/users";

type Page = { items: AdminUser[]; nextCursor: string | null };

export default function UsersPage() {
  const [first, setFirst] = useState<Page | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [maxBookingSeats, setMaxBookingSeats] = useState("");
  const [roleSlugs, setRoleSlugs] = useState<string[]>([]);

  function load() {
    fetchAdminUsers(null).then((result) => {
      if (result.ok) { setFirst(result.data); setError(null); }
      else setError(result.message);
    });
  }

  useEffect(load, []);
  useEffect(() => {
    fetchRolesPage(null).then((result) => {
      if (result.ok) setRoles(result.data.items.filter((role) => role.isActive));
    });
  }, []);

  function resetForm() {
    setSelected(null); setName(""); setEmail(""); setPassword(""); setIsActive(true); setMaxBookingSeats(""); setRoleSlugs([]); setError(null);
  }

  function toggleRole(slug: string) {
    setRoleSlugs((current) => current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]);
  }

  async function openEdit(user: AdminUser) {
    const result = await fetchAdminUser(user.id);
    if (!result.ok) return setError(result.message);
    const current = result.data;
    setSelected(current); setName(current.name ?? ""); setEmail(current.email ?? ""); setPassword(""); setIsActive(current.isActive); setMaxBookingSeats(current.maxBookingSeats ? String(current.maxBookingSeats) : "");
    setRoleSlugs(current.globalRoles?.map((entry) => entry.role.slug) ?? []);
    setError(null); setOpen(true);
  }

  async function save() {
    if (!email.trim() || (!selected && password.length < 8)) {
      setError(selected ? "أدخل البريد الإلكتروني الصحيح." : "أدخل البريد الإلكتروني وكلمة مرور من 8 أحرف على الأقل.");
      return;
    }
    setSaving(true); setError(null);
    if (!selected) {
      const result = await createAdminUser({ email: email.trim(), password, name: name.trim() || undefined, globalRoleSlugs: roleSlugs });
      setSaving(false);
      if (!result.ok) return setError(result.message);
    } else {
      const limit = maxBookingSeats.trim() === "" ? null : Number(maxBookingSeats);
      if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
        setSaving(false);
        setError("الحد الأقصى لمقاعد الحجز لازم يكون رقم صحيح أكبر من صفر.");
        return;
      }
      const profile = await updateAdminUser(selected.id, { name: name.trim() || undefined, isActive, ...(password ? { password } : {}), maxBookingSeats: limit });
      if (!profile.ok) { setSaving(false); return setError(profile.message); }
      const rolesResult = await setAdminUserRoles(selected.id, roleSlugs);
      setSaving(false);
      if (!rolesResult.ok) return setError(rolesResult.message);
    }
    setOpen(false); resetForm(); load();
  }

  async function remove() {
    if (!selected || !window.confirm(`هل تريد حذف حساب «${selected.name || selected.email}»؟`)) return;
    setSaving(true);
    const result = await deleteAdminUser(selected.id);
    setSaving(false);
    if (!result.ok) return setError(result.message);
    setOpen(false); resetForm(); load();
  }

  return <div className="dashboard-page">
    <div className="page-heading"><div><h1 className="page-title">مستخدمو الإدارة</h1><p className="page-description">حسابات فريق الإدارة وصلاحيات الوصول العامة للنظام.</p></div><Button type="button" onClick={() => { resetForm(); setOpen(true); }}><Plus className="size-4" /> مستخدم جديد</Button></div>
    {error && !open ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
    {!first ? <p className="text-sm text-[#606060]">جاري التحميل…</p> : <CursorList<AdminUser> initialItems={first.items} initialCursor={first.nextCursor} loadMore={(cursor) => fetchAdminUsers(cursor).then((result) => { if (!result.ok) throw new Error(result.message); return result.data; })} keyOf={(user) => user.id} emptyMessage="لا توجد حسابات إدارة" renderItem={(user) => <div className="list-card"><span className="min-w-0"><strong className="block truncate text-[#1a1a1a]">{user.name || "بدون اسم"}</strong><small dir="ltr" className="mt-1 block truncate text-[#5e6b78]">{user.email}</small></span><span className="flex items-center gap-3"><span className={user.isActive ? "status-pill" : "status-pill status-pill-muted"}>{user.isActive ? "نشط" : "موقوف"}</span><Button type="button" size="sm" variant="secondary" onClick={() => openEdit(user)}><Pencil className="size-4" /> تعديل</Button></span></div>} />}
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetForm(); }} title={selected ? "تعديل مستخدم الإدارة" : "مستخدم إدارة جديد"} description={selected ? "يمكن تعديل الاسم والحالة وكلمة المرور ومستويات الوصول." : "أنشئ حسابًا للفريق وحدد مستويات الوصول المطلوبة."} size="sm"><div className="space-y-4"><label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الاسم</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: مسؤول التشغيل" /></label><label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">البريد الإلكتروني</span><Input dir="ltr" type="email" value={email} disabled={Boolean(selected)} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" /></label><label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{selected ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور"}</span><Input dir="ltr" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={selected ? "اتركها كما هي دون تغيير" : "8 أحرف على الأقل"} /></label>{selected ? <label className="flex items-center gap-2 rounded-xl bg-[#f8fbfd] p-3 text-sm"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="size-4 accent-[#2f719e]" /> الحساب نشط ويمكنه تسجيل الدخول</label> : null}{selected ? <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الحد الأقصى لمقاعد الحجز <span className="font-normal text-slate-400">(فارغ = الافتراضي {PLATFORM_DEFAULT_MAX_BOOKING_SEATS})</span></span><Input dir="ltr" inputMode="numeric" type="number" min={1} value={maxBookingSeats} onChange={(event) => setMaxBookingSeats(event.target.value)} placeholder={`الافتراضي ${PLATFORM_DEFAULT_MAX_BOOKING_SEATS}`} /></label> : null}{selected?.effectiveMaxBookingSeats != null ? <p className="rounded-xl bg-[#edf6fc] p-3 text-sm text-[#204c6b]">الحد الفعّال حاليًا: {selected.effectiveMaxBookingSeats} مقاعد</p> : null}<fieldset><legend className="mb-2 text-sm font-bold text-[#334454]">مستويات الوصول</legend><div className="grid gap-2 rounded-xl bg-[#f8fbfd] p-3">{roles.map((role) => <label key={role.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={roleSlugs.includes(role.slug)} onChange={() => toggleRole(role.slug)} className="size-4 accent-[#2f719e]" />{role.name}</label>)}</div></fieldset>{error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}<div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-between">{selected ? <Button type="button" variant="destructive" onClick={remove} disabled={saving}><Trash2 className="size-4" /> حذف الحساب</Button> : <span />}<div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>إلغاء</Button><Button type="button" onClick={save} disabled={saving}>{saving ? "جاري الحفظ…" : "حفظ الحساب"}</Button></div></div></div></Dialog>
  </div>;
}
