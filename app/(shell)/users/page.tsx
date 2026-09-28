"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { RowActions } from "@/components/ui/row-actions";
import { Dialog } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { InlineBlockSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchRolesPage, type Role } from "@/lib/actions/roles";
import { PLATFORM_DEFAULT_MAX_BOOKING_SEATS, createAdminUser, deleteAdminUser, fetchAdminUser, fetchAdminUsers, setAdminUserRoles, updateAdminUser, type AdminUser } from "@/lib/actions/users";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

type Page = { items: AdminUser[]; nextCursor: string | null };

export default function UsersPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: first, isLoading, error: fetchError } = useApiQuery<Page>(qk.adminUsers, () => fetchAdminUsers(null));
  const { data: rolesPage, isPending: rolesPending } = useApiQuery(qk.roles, () => fetchRolesPage(null));
  const roles = (rolesPage?.items ?? []).filter((role) => role.isActive);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [maxBookingSeats, setMaxBookingSeats] = useState("");
  const [roleSlugs, setRoleSlugs] = useState<string[]>([]);

  function load() {
    // نفضّل الكاش — البيانات تتحدث في الخلفية من غير ما تختفي أو تعيد التحميل
    void queryClient.invalidateQueries({ queryKey: qk.adminUsers });
  }

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
      setError(selected ? t("users.errors.invalidEmail") : t("users.errors.invalidEmailAndPassword"));
      return;
    }
    setError(null);
    if (!selected) {
      const result = await createAdminUser({ email: email.trim(), password, name: name.trim() || undefined, globalRoleSlugs: roleSlugs });
      if (!result.ok) return setError(result.message);
    } else {
      const limit = maxBookingSeats.trim() === "" ? null : Number(maxBookingSeats);
      if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
        setError(t("common.validation.seatLimit"));
        return;
      }
      const profile = await updateAdminUser(selected.id, { name: name.trim() || undefined, isActive, ...(password ? { password } : {}), maxBookingSeats: limit });
      if (!profile.ok) return setError(profile.message);
      const rolesResult = await setAdminUserRoles(selected.id, roleSlugs);
      if (!rolesResult.ok) return setError(rolesResult.message);
    }
    setOpen(false); resetForm(); load();
  }

  async function remove(user: AdminUser) {
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("users.deleteConfirm.description", { value: user.name || user.email }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteAdminUser(user.id);
    if (!result.ok) return setError(result.message);
    setOpen(false); resetForm(); load();
  }
  const userColumns: CommunityColumnDef<AdminUser>[] = [
    { field: "name", headerName: t("common.fields.name"), filter: "agTextColumnFilter", valueFormatter: (params) => params.value || t("common.value.withoutName") },
    { field: "email", headerName: t("common.fields.email"), filter: "agTextColumnFilter" },
    { field: "isActive", headerName: t("common.fields.status"), filter: "agTextColumnFilter", cellDataType: "text", valueFormatter: (params) => (params.value ? t("common.status.active") : t("common.status.inactive")) },
  ];

  return <div className="dashboard-page">
    <div className="page-heading"><div className="min-w-0 flex-1"><h1 className="page-title">{t("users.title")}</h1><p className="page-description">{t("users.description")}</p></div><Button type="button" onClick={() => { resetForm(); setOpen(true); }}><Plus className="size-4" /> {t("users.newUser")}</Button></div>
    {(error || fetchError) && !open ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error ?? fetchError?.message ?? t("common.error.somethingWentWrong")}</p> : null}
    {isLoading ? <TableSkeleton rows={8} columns={4} /> : <CursorList<AdminUser> gridId="admin-users" initialItems={first?.items ?? []} initialCursor={first?.nextCursor ?? null} loadMore={(cursor) => fetchAdminUsers(cursor).then((result) => { if (!result.ok) throw new Error(result.message); return result.data; })} keyOf={(user) => user.id} columnDefs={userColumns} emptyMessage={t("users.empty")} renderItem={(user) => <RowActions label={t("users.list.rowActions", { value: user.name || user.email || "" })} actions={[{ label: t("common.actions.edit"), icon: Pencil, onSelect: () => void openEdit(user) }, { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void remove(user) }]} />} />}
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetForm(); }} title={selected ? t("users.dialog.editTitle") : t("users.dialog.createTitle")} description={selected ? t("users.dialog.editDescription") : t("users.dialog.createDescription")} size="sm"><div className="space-y-4"><label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.name")}</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("users.placeholders.name")} /></label><label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.email")}</span><Input dir="ltr" type="email" value={email} disabled={Boolean(selected)} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" /></label><label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{selected ? t("users.dialog.newPasswordLabel") : t("users.dialog.fields.password")}</span><Input dir="ltr" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={selected ? t("users.placeholders.keepPassword") : t("users.placeholders.passwordMin")} /></label>{selected ? <label className="flex items-center gap-2 rounded-xl bg-[#f8fbfd] p-3 text-sm"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="size-4 accent-[#059ff8]" /> {t("users.dialog.activeAccount")}</label> : null}{selected ? <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.maxBookingSeats")} <span className="font-normal text-slate-400">{t("users.dialog.emptyUsesDefault")} {PLATFORM_DEFAULT_MAX_BOOKING_SEATS})</span></span><Input dir="ltr" inputMode="numeric" type="number" min={1} value={maxBookingSeats} onChange={(event) => setMaxBookingSeats(event.target.value)} placeholder={t("users.dialog.defaultSeatLimit", { PLATFORM_DEFAULT_MAX_BOOKING_SEATS: PLATFORM_DEFAULT_MAX_BOOKING_SEATS })} /></label> : null}{selected?.effectiveMaxBookingSeats != null ? <p className="rounded-xl bg-[#eaf6ff] p-3 text-sm text-[#00134c]">{t("users.dialog.effectiveLimit")} {selected.effectiveMaxBookingSeats} {t("users.dialog.seatsUnit")}</p> : null}<fieldset><legend className="mb-2 text-sm font-bold text-[#334454]">{t("users.dialog.roles")}</legend><div className="grid gap-2 rounded-xl bg-[#f8fbfd] p-3">{rolesPending ? <div role="status" className="grid gap-2"><span className="sr-only">{t("common.loading.more")}</span>{Array.from({ length: 3 }, (_, row) => <div key={row} className="flex items-center gap-2"><Skeleton className="size-4 shrink-0 rounded-md" /><InlineBlockSkeleton className="w-28" /></div>)}</div> : roles.map((role) => <label key={role.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={roleSlugs.includes(role.slug)} onChange={() => toggleRole(role.slug)} className="size-4 accent-[#059ff8]" />{role.name}</label>)}</div></fieldset>{error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}<div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t("common.actions.cancel")}</Button><AsyncButton type="button" onClick={save}>{t("users.dialog.submit")}</AsyncButton></div></div></Dialog>
  </div>;
}
