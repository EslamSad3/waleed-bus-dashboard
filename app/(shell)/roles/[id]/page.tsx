"use client";

import { schemaErrors, requiredField } from "@/lib/field-validation";

import { useFieldValidation, ValidationMessage, ValidationScope } from "@/components/ui/field-validation";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { rolePermissionsSchema } from "@/lib/schemas/admin-forms";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DetailPageSkeleton, InlineBlockSkeleton } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPermissionCatalog, type Permission } from "@/lib/actions/permissions";
import { fetchRole, replaceRolePermissions, updateRole, type RoleDetail } from "@/lib/actions/roles";
import { presentPermission } from "@/lib/permission-presentation";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { applyMutationCache, roleImpact } from "@/lib/cache/mutations";
import { t } from "@/lib/i18n/t";

export default function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [role, setRole] = useState<RoleDetail | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // TanStack cache: تفاصيل الدور والمهام بيتجابوا عبر طبقة الكاش
  const { data: roleData, error: roleError, refetch } = useApiQuery<RoleDetail>(qk.role(id), () => fetchRole(id));
  const { data: catalog, isPending: catalogPending } = useApiQuery<Permission[]>(qk.permissions, fetchPermissionCatalog);

  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Render-phase sync from the query cache (no setState-in-effect)
  const [seenRole, setSeenRole] = useState<RoleDetail | null>(null);
  if (roleData && roleData !== seenRole) {
    setSeenRole(roleData);
    setRole(roleData);
    setSelected(roleData.rolePermissions.map((item) => item.permission.key));
    setName(roleData.name);
    setDescription(roleData.description ?? "");
    setActive(roleData.isActive);
  }
  const [seenRoleError, setSeenRoleError] = useState<string | null>(null);
  const [seenCatalog, setSeenCatalog] = useState<Permission[] | null>(null);
  if (catalog && catalog !== seenCatalog) {
    setSeenCatalog(catalog);
    setPermissions(catalog);
  }
  if (roleError?.message !== seenRoleError) {
    setSeenRoleError(roleError?.message ?? null);
    if (roleError) setError(roleError.message);
  }

  const permissionsByGroup = useMemo(() => permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
    const group = presentPermission(permission).group;
    (groups[group] ??= []).push(permission);
    return groups;
  }, {}), [permissions]);

  const validation = useFieldValidation(() => ({ name: requiredField(name) || (name.trim().length > 100 ? t("validation.maxLength", { max: 100 }) : undefined), description: description.length > 500 ? t("validation.maxLength", { max: 500 }) : undefined }));

  async function saveDetails() {
    if (!validation.validate()) return;
    if (!role) return;
    setSaving(true); setError(null);
    const result = await updateRole(role.id, { name: name.trim(), description: description.trim(), isActive: active });
    setSaving(false);
    if (!result.ok) { setError(validation.failure(result)); return; }
    setRole({ ...role, ...result.data });
    // The list behind this page must show the new name/description without a
    // manual refresh.
    applyMutationCache(queryClient, roleImpact(result.data, "update"), result);
  }

  const permissionValidation = useFieldValidation(() => schemaErrors(rolePermissionsSchema, { permissionKeys: selected }));

  async function savePermissions() {
    if (!permissionValidation.validate()) return;
    if (!role) return;
    setSaving(true); setError(null);
    const result = await replaceRolePermissions(role.id, selected);
    setSaving(false);
    if (!result.ok) { setError(permissionValidation.failure(result)); return; }
    applyMutationCache(queryClient, roleImpact(role, "update"), result);
    reload();
  }

  function toggle(key: string) {
    permissionValidation.change("permissionKeys");
    setSelected((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  }

  if (error && !role) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!role) return <DetailPageSkeleton />;
  const isEditable = !role.isSystem;

  return (
    <ValidationScope validation={validation}><div className="dashboard-page">
      <Link href="/roles" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-[#059ff8]"><ArrowRight className="size-4" /> {t("roles.detail.backToList")}</Link>
      <div className="page-heading"><div className="min-w-0 flex-1"><h1 className="page-title">{role.name}</h1><p className="page-description">{t("roles.detail.description")}</p></div>{role.isSystem ? <span className="max-md:self-start rounded-full bg-[#fff7e3] px-3 py-1 text-sm font-bold text-[#8a6515]">{t("roles.detail.systemBadge")}</span> : null}</div>
      {role.isSystem ? <p className="mb-5 rounded-xl bg-[#fff7e3] p-4 text-sm text-[#725314]">{t("roles.detail.systemNotice")}</p> : null}
      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <section className="panel-card p-5 sm:p-6"><h2 className="section-title mb-4">{t("roles.detail.sections.about")}</h2><div className="space-y-4"><label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">{t("roles.detail.fields.name")}</span><Input fieldName="name" value={name} onChange={(event) => setName(event.target.value)} disabled={!isEditable} /></label><label className="block text-sm"><span className="mb-2 block font-bold text-[#334454]">{t("roles.detail.fields.description")}</span><Input fieldName="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("roles.detail.placeholders.description")} disabled={!isEditable} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} disabled={!isEditable} className="size-4 accent-[#059ff8]" />{t("roles.detail.activeHint")}</label>{isEditable ? <Button type="button" onClick={saveDetails} loading={saving}>{t("roles.detail.actions.saveInfo")}</Button> : null}</div></section>
        <ValidationScope validation={permissionValidation}><section className="panel-card p-5 sm:p-6"><ValidationMessage name="permissionKeys" /><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="section-title">{t("roles.detail.sections.permissions")}</h2><p className="mt-1 text-sm text-[#606060]">{t("roles.detail.permissionsHint")}</p></div>{isEditable ? <Button type="button" onClick={savePermissions} loading={saving}>{saving ? t("common.loading.saving") : t("roles.detail.actions.savePermissions")}</Button> : null}</div>{catalogPending ? <div role="status" className="space-y-5"><span className="sr-only">{t("common.loading.more")}</span>{[0, 1].map((group) => <div key={group}><Skeleton className="mb-2 h-4 w-28" /><div className="grid gap-2 sm:grid-cols-2">{Array.from({ length: 4 }, (_, item) => <div key={item} className="flex items-start gap-3 rounded-xl border border-[#e4ecf2] bg-[#f8fbfd] p-3"><Skeleton className="mt-0.5 size-4 shrink-0 rounded-md" /><div className="min-w-0 flex-1 space-y-1.5"><InlineBlockSkeleton className="h-3.5 w-24" /><InlineBlockSkeleton className="h-3 w-32" /></div></div>)}</div></div>)}</div> : <div className="space-y-5">{Object.entries(permissionsByGroup).map(([group, items]) => <div key={group}><h3 className="mb-2 text-sm font-bold text-[#00134c]">{group}</h3><div className="grid gap-2 sm:grid-cols-2">{items.map((permission) => { const presentation = presentPermission(permission); return <label key={permission.id} className="flex items-start gap-3 rounded-xl border border-[#e4ecf2] bg-[#f8fbfd] p-3 text-sm"><input type="checkbox" checked={selected.includes(permission.key)} onChange={() => toggle(permission.key)} disabled={!isEditable || !permission.isActive} className="mt-0.5 size-4 accent-[#059ff8]" /><span className="min-w-0"><span className="block font-bold text-[#334454]">{presentation.title}</span><span className="text-xs text-[#71808d]">{presentation.description}</span></span></label>; })}</div></div>)}</div>}</section></ValidationScope>
      </div>
    </div></ValidationScope>
  );
}
