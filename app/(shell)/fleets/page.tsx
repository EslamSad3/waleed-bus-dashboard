"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { createFleet, deleteFleet, fetchFleetsPage, fetchUserOptions, updateFleet, type Fleet } from "@/lib/actions/fleets";
import { useFilterStore } from "@/stores/filters";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeletons";
import { qk, upsertInCursorList, removeFromCursorList, useApiQuery, useDataQuery, useQueryClient } from "@/lib/queries";

type FleetRow = Fleet & { ownerName: string };

type Owner = { id: string; name?: string | null; email?: string | null; phone?: string | null };

async function withOwnerNames(page: { items: Fleet[]; nextCursor: string | null }): Promise<{ items: FleetRow[]; nextCursor: string | null }> {
  const users = await fetchUserOptions();
  const ownerNames = users.ok
    ? new Map(users.data.items.map((user) => [user.id, user.name || user.email || user.phone || user.phoneNumber || "غير معروف"]))
    : new Map<string, string>();
  return {
    nextCursor: page.nextCursor,
    items: page.items.map((fleet) => ({ ...fleet, ownerName: ownerNames.get(fleet.ownerId) ?? "غير معروف" })),
  };
}

async function fetchFirstFleetsPage(): Promise<{ items: FleetRow[]; nextCursor: string | null }> {
  const r = await fetchFleetsPage(null);
  if (!r.ok) throw new Error(r.message);
  return withOwnerNames(r.data);
}

/** نافذة إضافة أسطول — الدور ثابت fleet_owner من غير خانة اختيار. */
function CreateFleetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: ownersPage, isLoading: ownersLoading } = useApiQuery<{ items: Owner[] }>(["users", "options"], () => fetchUserOptions(), { enabled: open });
  const ownerName = (ownersPage?.items ?? []).find((owner) => owner.id === ownerId)?.name ?? "غير معروف";

  function resetForm() {
    setName("");
    setOwnerId("");
    setError(null);
  }

  async function submit() {
    setError(null);
    if (!name.trim() || !ownerId) {
      setError("أكمل اسم الأسطول واختار المالك.");
      return;
    }
    setSaving(true);
    // الدور الابتدائي للمالك ثابت fleet-owner (متسجل في النظام) — من غير خانة دور.
    const r = await createFleet({ name: name.trim(), ownerId, ownerRoleSlug: "fleet-owner" });
    setSaving(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    upsertInCursorList<FleetRow>(queryClient, qk.fleets, { ...r.data, ownerName });
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title="أسطول جديد" description="أضف أسطولًا جديدًا واربطه بالمالك المسؤول." size="sm">
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">اسم الأسطول</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="أسطول القاهرة" />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">المالك</span>
          {ownersLoading ? (
            <span role="status" className="block">
              <span className="sr-only">جاري التحميل…</span>
              <Skeleton aria-hidden="true" className="h-11 w-full rounded-xl" />
            </span>
          ) : (
            <select aria-label="اختار المالك" value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="select-field w-full">
              <option value="">اختار المالك</option>
              {(ownersPage?.items ?? []).map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name || owner.email || owner.phone || owner.id}
                </option>
              ))}
            </select>
          )}
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>إلغاء</Button>
          <Button type="button" variant="success" onClick={() => void submit()} loading={saving}>
            {saving ? "جاري الحفظ…" : "إضافة الأسطول"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** نافذة تعديل أسطول — الاسم والحالة بس، المالك بيتغير من صفحة صاحب العربية. */
function EditFleetDialog({ open, fleet, onClose }: { open: boolean; fleet: FleetRow | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (fleet && fleet.id !== loadedFor) {
    setLoadedFor(fleet.id);
    setName(fleet.name);
    setIsActive(fleet.isActive);
    setError(null);
  }

  function resetForm() {
    setLoadedFor(null);
    setError(null);
  }

  async function submit() {
    if (!fleet) return;
    setError(null);
    if (!name.trim()) {
      setError("اكتب اسم الأسطول.");
      return;
    }
    setSaving(true);
    const r = await updateFleet(fleet.id, { name: name.trim(), isActive });
    setSaving(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    // نحافظ على اسم المالك المحلي اللي اتجمع من /users
    upsertInCursorList<FleetRow>(queryClient, qk.fleets, { ...r.data, ownerName: fleet.ownerName });
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open && Boolean(fleet)} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title="تعديل أسطول" description={fleet ? `بتعدّل بيانات «${fleet.name}».` : undefined} size="sm">
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">اسم الأسطول</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="flex items-center gap-2 rounded-xl bg-[#f8fbfd] p-3 text-sm">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="size-4 accent-[#059ff8]" />
          الأسطول نشط ويشغّل عربيات
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>إلغاء</Button>
          <Button type="button" variant="success" onClick={() => void submit()} loading={saving}>{saving ? "جاري الحفظ…" : "حفظ التعديلات"}</Button>
        </div>
      </div>
    </Dialog>
  );
}

export default function FleetsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const [fleetForEdit, setFleetForEdit] = useState<FleetRow | null>(null);
  const { listFilters, setListFilter } = useFilterStore();
  const f = listFilters["fleets"] ?? {};

  const { data: first, isLoading, error } = useDataQuery<{ items: FleetRow[]; nextCursor: string | null }>(
    qk.fleets,
    fetchFirstFleetsPage,
  );

  async function removeFleet(fleet: FleetRow) {
    if (!(await confirm({ title: "تأكيد المسح", description: `الإجراء ده مينفعش يتراجع — تمسح أسطول «${fleet.name}»؟ امسح عربياته ورحلاته الأول لو لسه فيها بيانات.`, confirmLabel: "مسح", destructive: true }))) return;
    const r = await deleteFleet(fleet.id);
    if (!r.ok) return;
    removeFromCursorList<FleetRow>(queryClient, qk.fleets, fleet.id);
  }

  const q = (f.q ?? "").trim();
  const status = f.status ?? "all";
  const predicate = (fleet: FleetRow) =>
    (!q || fleet.name.includes(q) || fleet.ownerName.includes(q)) &&
    (status === "all" || (status === "active" ? fleet.isActive : !fleet.isActive));

  const columns: CommunityColumnDef<FleetRow>[] = [
    { field: "name", headerName: "الأسطول", filter: "agTextColumnFilter" },
    { field: "ownerName", headerName: "صاحب العربيات", filter: "agTextColumnFilter" },
    { field: "isActive", headerName: "الحالة", filter: "agTextColumnFilter", cellDataType: "text", valueFormatter: (params) => params.value ? "نشط" : "موقوف" },
    { field: "createdAt", headerName: "تاريخ الإنشاء", filter: "agDateColumnFilter", valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString("ar-EG") : "—" },
    { field: "updatedAt", headerName: "آخر تحديث", filter: "agDateColumnFilter", valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString("ar-EG") : "—" },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0">
          <h1 className="page-title">الأساطيل</h1>
          <p className="page-description">كل الأساطيل المسجلة وحالة تشغيل كل أسطول.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>أسطول جديد</Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">{error.message}</p>
      ) : isLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : (
        <CursorList<FleetRow>
          initialItems={first?.items ?? []}
          initialCursor={first?.nextCursor ?? null}
          loadMore={(cursor) =>
            fetchFleetsPage(cursor).then(async (r) => {
              if (!r.ok) throw new Error(r.message);
              return withOwnerNames(r.data);
            })
          }
          keyOf={(fleet) => fleet.id}
          filter={predicate}
          columnDefs={columns}
          filterBar={
            <div className="contents">
              <Input
                aria-label="دور باسم الأسطول أو المالك"
                placeholder="دور باسم الأسطول أو المالك"
                value={f.q ?? ""}
                onChange={(e) => setListFilter("fleets", { q: e.target.value })}
                className="min-w-0 flex-1 bg-white md:max-w-72"
              />
              <select
                aria-label="الحالة"
                value={status}
                onChange={(e) => setListFilter("fleets", { status: e.target.value })}
                className="select-field max-md:w-full"
              >
                <option value="all">الكل</option>
                <option value="active">نشط</option>
                <option value="inactive">موقوف</option>
              </select>
            </div>
          }
          emptyMessage="لا توجد أساطيل بعد — ابدأ بإضافة جديد"
          renderItem={(fleet) => (
            <RowActionsMenu
              label={`إجراءات أسطول ${fleet.name}`}
              actions={[
                { label: "فتح التفاصيل", href: `/fleets/${fleet.id}` },
                { label: "تعديل", onSelect: () => setFleetForEdit(fleet) },
                { label: "مسح", danger: true, onSelect: () => void removeFleet(fleet) },
              ]}
            />
          )}
        />
      )}
      <CreateFleetDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditFleetDialog open={Boolean(fleetForEdit)} fleet={fleetForEdit} onClose={() => setFleetForEdit(null)} />
    </div>
  );
}
