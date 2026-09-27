"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import {
  addMember,
  fetchMembersPage,
  fetchRoleOptions,
  removeMember,
  updateMember,
  MEMBER_STATUS_AR,
  type Member,
  type MemberPage,
} from "@/lib/actions/members";
import { fetchUserOptions } from "@/lib/actions/fleets";
import { qk, removeFromList, upsertInList, useApiQuery, useQueryClient } from "@/lib/queries";

const REVOKE_WARNING = "الإجراء ده هيقفل جلسات المستخدم فورا — متأكد؟";

type UserOption = { id: string; name?: string | null; email?: string | null; phone?: string | null; phoneNumber?: string | null };
type RoleOption = { id: string; slug: string; name?: string | null };

/** نافذة إضافة عضو — قايمة مستخدمين جاهزة بدل لصق UUID. */
function AddMemberDialog({ open, fleetId, onClose }: { open: boolean; fleetId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: usersPage } = useApiQuery<{ items: UserOption[] }>(["users", "options"], () => fetchUserOptions(), { enabled: open });
  const { data: rolesPage } = useApiQuery<{ items: RoleOption[] }>(["roles", "options"], () => fetchRoleOptions(), { enabled: open });
  const { data: membersPage } = useApiQuery<MemberPage>(qk.fleetMembers(fleetId), () => fetchMembersPage(fleetId, null), { enabled: open });

  const existingUserIds = new Set((membersPage?.items ?? []).map((member) => member.userId));
  const userOptions = (usersPage?.items ?? []).filter((user) => !existingUserIds.has(user.id));

  function resetForm() {
    setUserId("");
    setRoleSlug("");
    setError(null);
  }

  async function submit() {
    setError(null);
    if (!userId) {
      setError("اختار المستخدم الأول.");
      return;
    }
    setSaving(true);
    const r = await addMember(fleetId, { userId, roleSlug: roleSlug || undefined });
    setSaving(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    const refreshed = await fetchMembersPage(fleetId, null);
    if (refreshed.ok) queryClient.setQueryData<MemberPage>(qk.fleetMembers(fleetId), refreshed.data);
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title="إضافة عضو" description="اختار المستخدم والدور من القايمة — اللي متضاف بالفعل مش بيظهر." size="sm">
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">المستخدم</span>
          <select aria-label="اختار المستخدم" value={userId} onChange={(event) => { setUserId(event.target.value); setError(null); }} className="select-field w-full">
            <option value="">{userOptions.length ? "اختار المستخدم…" : "مفيش مستخدمين متاحين"}</option>
            {userOptions.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name || user.email || user.phone || user.phoneNumber || user.id}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">الدور</span>
          <select aria-label="اختار الدور" value={roleSlug} onChange={(event) => setRoleSlug(event.target.value)} className="select-field w-full">
            <option value="">الدور الافتراضي</option>
            {(rolesPage?.items ?? []).map((role) => (
              <option key={role.id} value={role.slug}>{role.name || role.slug}</option>
            ))}
          </select>
        </label>
        {userOptions.length === 0 ? (
          <p className="rounded-xl bg-[#eaf6ff] p-3 text-sm text-[#00134c]">كل المستخدمين متضافين بالفعل للأسطول ده.</p>
        ) : null}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 border-t border-[#e4ecf2] pt-4">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>إلغاء</Button>
          <Button type="button" variant="success" onClick={() => void submit()} disabled={saving || !userId}>{saving ? "جاري الإضافة…" : "إضافة"}</Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Fleet Members tab (US5) — جدول ag-grid: الاسم والتاريخ والحالة وتمت الإضافة بواسطة + إجراءات. */
export function MembersTab({ fleetId }: { fleetId: string }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const { data: page, isLoading, error } = useApiQuery<MemberPage>(qk.fleetMembers(fleetId), () => fetchMembersPage(fleetId, null));
  const members = page?.items ?? [];

  async function changeStatus(member: Member, next: Member["status"]) {
    if (next !== "ACTIVE" && !window.confirm(REVOKE_WARNING)) return;
    const r = await updateMember(fleetId, member.id, { status: next });
    if (!r.ok) return;
    upsertInList(queryClient, qk.fleetMembers(fleetId), r.data);
  }

  async function remove(member: Member) {
    if (!window.confirm(`${REVOKE_WARNING} تمسح العضوية؟`)) return;
    const r = await removeMember(fleetId, member.id);
    if (!r.ok) return;
    removeFromList(queryClient, qk.fleetMembers(fleetId), member.id);
  }

  const columns: CommunityColumnDef<Member>[] = [
    {
      field: "userId",
      headerName: "الاسم",
      filter: "agTextColumnFilter",
      // أسماء المستخدمين فقط — الـ UUID مش معروض
      valueGetter: (params) => params.data?.user?.name ?? params.data?.user?.nickname ?? params.data?.user?.phoneNumber ?? "بدون اسم",
      cellRenderer: (params: { data?: Member }) => {
        const member = params.data;
        if (!member) return null;
        return (
          <span className="font-bold">
            {member.user?.name ?? member.user?.nickname ?? "بدون اسم"}
            {member.user?.phoneNumber ? <span className="mr-2 text-xs font-normal text-[#606060]" dir="ltr">{member.user.phoneNumber}</span> : null}
            <span className={member.status === "ACTIVE" ? "mr-2 status-pill" : "mr-2 status-pill status-pill-muted"}>{MEMBER_STATUS_AR[member.status]}</span>
          </span>
        );
      },
    },
    { field: "role.slug", headerName: "الدور", valueGetter: (params) => params.data?.role?.name || params.data?.role?.slug || "—" },
    { field: "joinedAt", headerName: "تاريخ الانضمام", filter: "agDateColumnFilter", valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString("ar-EG") : "—" },
    {
      field: "assignedBy",
      headerName: "تمت الإضافة بواسطة",
      valueGetter: (params) => params.data?.assignedByUser?.name ?? "—",
    },
    { field: "status", headerName: "الحالة", filter: "agTextColumnFilter", cellDataType: "text", valueFormatter: (params) => MEMBER_STATUS_AR[params.value as Member["status"]] ?? params.value },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title mb-0">أعضاء الأسطول</h2>
        <Button type="button" onClick={() => setAddOpen(true)}>إضافة عضو</Button>
      </div>

      <CursorList<Member>
        gridId={`fleet-members-${fleetId}`}
        initialItems={members}
        initialCursor={page?.nextCursor ?? null}
        loadMore={async (cursor) => {
          const result = await fetchMembersPage(fleetId, cursor);
          if (!result.ok) throw new Error(result.message);
          return result.data;
        }}
        keyOf={(member) => member.id}
        columnDefs={columns}
        emptyMessage="لا يوجد أعضاء في الأسطول ده — ابدأ بإضافة عضو."
        renderItem={(member) => (
          <RowActionsMenu
            label={`إجراءات عضو ${member.user?.name ?? ""}`}
            actions={[
              ...(["ACTIVE", "SUSPENDED", "REVOKED"] as Member["status"][])
                .filter((status) => status !== member.status)
                .map((status) => ({
                  label: status === "ACTIVE" ? "تفعيل" : status === "SUSPENDED" ? "إيقاف" : "إلغاء الصلاحية",
                  onSelect: () => void changeStatus(member, status),
                })),
              { label: "مسح العضوية", danger: true, onSelect: () => void remove(member) },
            ]}
          />
        )}
      />

      <AddMemberDialog open={addOpen} fleetId={fleetId} onClose={() => setAddOpen(false)} />
    </div>
  );
}
