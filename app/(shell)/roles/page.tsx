"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import { createRole, fetchRolesPage, type Role } from "@/lib/actions/roles";

type FirstPage = { items: Role[]; nextCursor: string | null };

export default function RolesPage() {
  const router = useRouter();
  const [first, setFirst] = useState<FirstPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchRolesPage(null).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setFirst(result.data);
        setError(null);
      } else {
        setError(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (!name.trim()) {
      setError("اكتب اسم مستوى الوصول");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createRole({ name: name.trim(), slug: `custom-role-${Date.now()}`, description: description.trim() || undefined });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOpen(false);
    router.push(`/roles/${result.data.id}`);
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">مستويات الوصول</h1>
          <p className="page-description">حدّد ما يستطيع كل فريق القيام به، مثل إدارة الرحلات أو متابعة الحجوزات.</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}><Plus aria-hidden="true" /> مستوى وصول جديد</Button>
      </div>

      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {!first ? <p className="text-sm text-[#606060]">جاري التحميل…</p> : <CursorList<Role>
        initialItems={first.items}
        initialCursor={first.nextCursor}
        loadMore={(cursor) => fetchRolesPage(cursor).then((result) => {
          if (!result.ok) throw new Error(result.message);
          return result.data;
        })}
        keyOf={(role) => role.id}
        emptyMessage="لا توجد أدوار متاحة"
        renderItem={(role) => <Link href={`/roles/${role.id}`} className="list-card"><span><span className="block font-semibold text-[#1a1a1a]">{role.name}</span>{role.description ? <span className="mt-1 block text-sm text-[#71808d]">{role.description}</span> : <span className="mt-1 block text-sm text-[#71808d]">اضغط لتحديد المهام التي يستطيع هذا الدور تنفيذها.</span>}</span><span className="flex items-center gap-2"><span className={role.isActive ? "status-pill" : "status-pill status-pill-muted"}>{role.isActive ? "مفعّل" : "موقوف"}</span>{role.isSystem ? <span className="rounded-full bg-[#fff7e3] px-2 py-1 text-xs font-bold text-[#8a6515]">محمي</span> : null}</span></Link>}
      />}

      <Dialog open={open} onOpenChange={setOpen} title="مستوى وصول جديد" description="اختر اسمًا واضحًا للفريق، ثم حدّد المهام المسموح بها في الخطوة التالية." size="sm">
        <div className="space-y-4">
          <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">اسم مستوى الوصول</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: مسؤول التشغيل" autoFocus /></label>
          <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">متى يُستخدم؟</span><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="مثال: للفريق الذي يتابع الرحلات اليومية" /></label>
          <div className="flex justify-end gap-2 border-t border-[#e4ecf2] pt-4"><Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>إلغاء</Button><Button type="button" onClick={save} disabled={saving}>{saving ? "جاري الحفظ…" : "التالي: اختيار المهام"}</Button></div>
        </div>
      </Dialog>
    </div>
  );
}
