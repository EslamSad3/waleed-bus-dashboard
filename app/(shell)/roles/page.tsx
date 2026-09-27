"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeletons";
import { CursorList } from "@/components/tables/cursor-list";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { createRole, deleteRole, fetchRolesPage, type Role } from "@/lib/actions/roles";
import { qk, removeFromCursorList, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";

type FirstPage = { items: Role[]; nextCursor: string | null };

export default function RolesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: first, isLoading, error: fetchError } = useApiQuery<FirstPage>(qk.roles, () => fetchRolesPage(null));
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function removeRole(role: Role) {
    if (role.isSystem) {
      setError("مستويات الوصول الأساسية مينفعش تتمسح — قفلها بدل كده من صفحتها.");
      return;
    }
    if (!(await confirm({ title: "تأكيد المسح", description: `تمسح مستوى وصول «${role.name}»؟ أي حسابات مرتبطة بيه هتفقد صلاحياته.`, confirmLabel: "مسح", destructive: true }))) return;
    const result = await deleteRole(role.id);
    if (!result.ok) return setError(result.message);
    removeFromCursorList<Role>(queryClient, qk.roles, role.id);
  }

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
        <div className="min-w-0 flex-1">
          <h1 className="page-title">مستويات الوصول</h1>
          <p className="page-description">حدّد ما يستطيع كل فريق القيام به، مثل إدارة الرحلات أو متابعة الحجوزات.</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}><Plus aria-hidden="true" /> مستوى وصول جديد</Button>
      </div>

      {(error || fetchError) ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error ?? fetchError?.message ?? "حصلت مشكلة"}</p> : null}
      {isLoading ? <TableSkeleton rows={8} columns={6} /> : <CursorList<Role>
        initialItems={first?.items ?? []}
        initialCursor={first?.nextCursor ?? null}
        loadMore={(cursor) => fetchRolesPage(cursor).then((result) => {
          if (!result.ok) throw new Error(result.message);
          return result.data;
        })}
        keyOf={(role) => role.id}
        emptyMessage="لا توجد أدوار متاحة"
        renderItem={(role) => (
          <RowActionsMenu
            label={`إجراءات مستوى ${role.name}`}
            actions={[
              { label: "فتح التفاصيل", href: `/roles/${role.id}` },
              { label: "مسح", danger: true, disabled: role.isSystem, onSelect: () => void removeRole(role) },
            ]}
          />
        )}
      />}

      <Dialog open={open} onOpenChange={setOpen} title="مستوى وصول جديد" description="اختر اسمًا واضحًا للفريق، ثم حدّد المهام المسموح بها في الخطوة التالية." size="sm">
        <div className="space-y-4">
          <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">اسم مستوى الوصول</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: مسؤول التشغيل" autoFocus /></label>
          <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">متى يُستخدم؟</span><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="مثال: للفريق الذي يتابع الرحلات اليومية" /></label>
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>إلغاء</Button><Button type="button" onClick={save} loading={saving}>{saving ? "جاري الحفظ…" : "التالي: اختيار المهام"}</Button></div>
        </div>
      </Dialog>
    </div>
  );
}
