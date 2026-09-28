"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeletons";
import { CursorList } from "@/components/tables/cursor-list";
import { RowActions } from "@/components/ui/row-actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { createRole, deleteRole, fetchRolesPage, type Role } from "@/lib/actions/roles";
import { qk, removeFromCursorList, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

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
      setError(t("roles.errors.systemRole"));
      return;
    }
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("roles.deleteConfirm.description", { roleName: role.name }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteRole(role.id);
    if (!result.ok) return setError(result.message);
    removeFromCursorList<Role>(queryClient, qk.roles, role.id);
  }

  async function save() {
    if (!name.trim()) {
      setError(t("roles.errors.nameRequired"));
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
          <h1 className="page-title">{t("roles.title")}</h1>
          <p className="page-description">{t("roles.description")}</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}><Plus aria-hidden="true" /> {t("roles.newRole")}</Button>
      </div>

      {(error || fetchError) ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error ?? fetchError?.message ?? t("common.error.somethingWentWrong")}</p> : null}
      {isLoading ? <TableSkeleton rows={8} columns={6} /> : <CursorList<Role>
        initialItems={first?.items ?? []}
        initialCursor={first?.nextCursor ?? null}
        loadMore={(cursor) => fetchRolesPage(cursor).then((result) => {
          if (!result.ok) throw new Error(result.message);
          return result.data;
        })}
        keyOf={(role) => role.id}
        emptyMessage={t("roles.empty")}
        renderItem={(role) => (
          <RowActions
            label={t("roles.list.rowActions", { roleName: role.name })}
            actions={[
              { label: t("common.actions.openDetails"), icon: Eye, href: `/roles/${role.id}` },
              { label: t("common.actions.delete"), icon: Trash2, tone: "danger", disabled: role.isSystem, onSelect: () => void removeRole(role) },
            ]}
          />
        )}
      />}

      <Dialog open={open} onOpenChange={setOpen} title={t("roles.createDialog.title")} description={t("roles.createDialog.description")} size="sm">
        <div className="space-y-4">
          <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">{t("roles.createDialog.nameLabel")}</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("roles.placeholders.name")} autoFocus /></label>
          <label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">{t("roles.createDialog.whenLabel")}</span><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("roles.placeholders.when")} /></label>
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>{t("common.actions.cancel")}</Button><Button type="button" onClick={save} loading={saving}>{saving ? t("common.loading.saving") : t("roles.createDialog.next")}</Button></div>
        </div>
      </Dialog>
    </div>
  );
}
