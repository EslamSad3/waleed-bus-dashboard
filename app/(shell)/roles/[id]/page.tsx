"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchPermissionCatalog, type Permission } from "@/lib/actions/permissions";
import { fetchRole, replaceRolePermissions, updateRole, type RoleDetail } from "@/lib/actions/roles";
import { presentPermission } from "@/lib/permission-presentation";

export default function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [role, setRole] = useState<RoleDetail | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    return Promise.all([fetchRole(id), fetchPermissionCatalog()]).then(([roleResult, permissionsResult]) => {
      if (!roleResult.ok) {
        setError(roleResult.message);
        return;
      }
      if (!permissionsResult.ok) {
        setError(permissionsResult.message);
        return;
      }
      setError(null);
      setRole(roleResult.data);
      setPermissions(permissionsResult.data);
      setSelected(roleResult.data.rolePermissions.map((item) => item.permission.key));
      setName(roleResult.data.name);
      setDescription(roleResult.data.description ?? "");
      setActive(roleResult.data.isActive);
    });
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const permissionsByGroup = useMemo(() => permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
    const group = presentPermission(permission).group;
    (groups[group] ??= []).push(permission);
    return groups;
  }, {}), [permissions]);

  async function saveDetails() {
    if (!role) return;
    setSaving(true); setError(null); setNote(null);
    const result = await updateRole(role.id, { name: name.trim(), description: description.trim(), isActive: active });
    setSaving(false);
    if (!result.ok) { setError(result.message); return; }
    setRole({ ...role, ...result.data });
    setNote("تم حفظ بيانات الدور");
  }

  async function savePermissions() {
    if (!role) return;
    setSaving(true); setError(null); setNote(null);
    const result = await replaceRolePermissions(role.id, selected);
    setSaving(false);
    if (!result.ok) { setError(result.message); return; }
    setNote("تم تحديث صلاحيات الدور");
    load();
  }

  function toggle(key: string) {
    setSelected((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  }

  if (error && !role) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!role) return <p className="text-sm text-[#606060]">جاري التحميل…</p>;
  const isEditable = !role.isSystem;

  return (
    <div className="dashboard-page">
      <Link href="/roles" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-[#2f719e]"><ArrowRight className="size-4" /> كل مستويات الوصول</Link>
      <div className="page-heading"><div><h1 className="page-title">{role.name}</h1><p className="page-description">حدد المهام التي يستطيع الأشخاص بهذا المستوى القيام بها.</p></div>{role.isSystem ? <span className="rounded-full bg-[#fff7e3] px-3 py-1 text-sm font-bold text-[#8a6515]">إعداد محمي</span> : null}</div>
      {role.isSystem ? <p className="mb-5 rounded-xl bg-[#fff7e3] p-4 text-sm text-[#725314]">هذا مستوى وصول أساسي للنظام. يمكنك مراجعته، لكن لا يمكن تعديل مهامه أو إيقافه.</p> : null}
      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {note ? <p role="status" className="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-700">{note}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <section className="panel-card p-5 sm:p-6"><h2 className="section-title mb-4">عن مستوى الوصول</h2><div className="space-y-4"><label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">الاسم</span><Input value={name} onChange={(event) => setName(event.target.value)} disabled={!isEditable} /></label><label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">الوصف</span><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="اشرح لمن يناسب هذا المستوى" disabled={!isEditable} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} disabled={!isEditable} className="size-4 accent-[#2f719e]" />هذا المستوى متاح للاستخدام</label>{isEditable ? <Button type="button" onClick={saveDetails} disabled={saving}>حفظ المعلومات</Button> : null}</div></section>
        <section className="panel-card p-5 sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="section-title">المهام المسموح بها</h2><p className="mt-1 text-sm text-[#606060]">اختر ما يستطيع هذا الفريق رؤيته أو تغييره داخل المنصة.</p></div>{isEditable ? <Button type="button" onClick={savePermissions} disabled={saving}>{saving ? "جاري الحفظ…" : "حفظ المهام"}</Button> : null}</div><div className="space-y-5">{Object.entries(permissionsByGroup).map(([group, items]) => <div key={group}><h3 className="mb-2 text-sm font-bold text-[#204c6b]">{group}</h3><div className="grid gap-2 sm:grid-cols-2">{items.map((permission) => { const presentation = presentPermission(permission); return <label key={permission.id} className="flex items-start gap-3 rounded-xl border border-[#e4ecf2] bg-[#f8fbfd] p-3 text-sm"><input type="checkbox" checked={selected.includes(permission.key)} onChange={() => toggle(permission.key)} disabled={!isEditable || !permission.isActive} className="mt-0.5 size-4 accent-[#2f719e]" /><span><span className="block font-bold text-[#334454]">{presentation.title}</span><span className="text-xs text-[#71808d]">{presentation.description}</span></span></label>; })}</div></div>)}</div></section>
      </div>
    </div>
  );
}
