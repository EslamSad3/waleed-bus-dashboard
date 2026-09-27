"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import { createRole, fetchRolesPage, type Role } from "@/lib/actions/roles";
import { qk, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";

type FirstPage = { items: Role[]; nextCursor: string | null };

export default function RolesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: first, isLoading, error: fetchError } = useApiQuery<FirstPage>(qk.roles, () => fetchRolesPage(null));
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

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
    upsertInCursorList(queryClient, qk.roles, result.data);
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

      {(error || fetchError) ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error ?? fetchError?.message ?? "حصلت مشكلة"}</p> : null}
      {isLoading ? <p className="text-sm text-[#606060]">جاري التحميل…</p> : <CursorList<Role>
        initialItems={first?.items ?? []}
        initialCursor={first?.nextCursor ?? null}
        loadMore={(cursor) => fetchRolesPage(cursor).then((result) => {
          if (!result.ok) throw new Error(result.message);
          return result.data;
        })}
        keyOf={(role) => role.id}
        emptyMessage="لا توجد أدوار متاحة"
        renderItem={(role) => <Link href={`/roles/${role.id}`} />}
      />}

      <Dialog open={open} onOpenChange={setOpen} title="مستوى وصول جديد" description="اختر اسمًا واضحًا للفريق، ثم حدّد المهام المسموح بها في الخطوة التالية." size="sm">
        <div className="space-y-4">
          <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">اسم مستوى الوصول</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: مسؤول التشغيل" autoFocus /></label>
          <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">متى يُستخدم؟</span><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="مثال: للفريق الذي يتابع الرحلات اليومية" /></label>
          <div className="flex justify-end gap-2 border-t border-[#e4ecf2] pt-4"><Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>إلغاء</Button><Button type="button" onClick={save} loading={saving}>{saving ? "جاري الحفظ…" : "التالي: اختيار المهام"}</Button></div>
        </div>
      </Dialog>
    </div>
  );
}
