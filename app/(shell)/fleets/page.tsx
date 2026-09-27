"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { createFleet, fetchFleetsPage, fetchUserOptions, type Fleet } from "@/lib/actions/fleets";
import { useFilterStore } from "@/stores/filters";
import { qk, upsertInCursorList, useApiQuery, useDataQuery, useQueryClient } from "@/lib/queries";

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

  const { data: ownersPage } = useApiQuery<{ items: Owner[] }>(["users", "options"], () => fetchUserOptions(), { enabled: open });
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
          <select aria-label="اختار المالك" value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="select-field w-full">
            <option value="">اختار المالك</option>
            {(ownersPage?.items ?? []).map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name || owner.email || owner.phone || owner.id}
              </option>
            ))}
          </select>
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 border-t border-[#e4ecf2] pt-4">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>إلغاء</Button>
          <Button type="button" variant="success" onClick={() => void submit()} disabled={saving}>
            {saving ? "جاري الحفظ…" : "إضافة الأسطول"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export default function FleetsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const { listFilters, setListFilter } = useFilterStore();
  const f = listFilters["fleets"] ?? {};

  const { data: first, isLoading, error } = useDataQuery<{ items: FleetRow[]; nextCursor: string | null }>(
    qk.fleets,
    fetchFirstFleetsPage,
  );

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
        <div>
          <h1 className="page-title">الأساطيل</h1>
          <p className="page-description">كل الأساطيل المسجلة وحالة تشغيل كل أسطول.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>أسطول جديد</Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">{error.message}</p>
      ) : isLoading ? (
        <p className="text-sm text-[#606060]">جاري التحميل…</p>
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
                className="max-w-xs bg-white"
              />
              <select
                aria-label="الحالة"
                value={status}
                onChange={(e) => setListFilter("fleets", { status: e.target.value })}
                className="select-field"
              >
                <option value="all">الكل</option>
                <option value="active">نشط</option>
                <option value="inactive">موقوف</option>
              </select>
            </div>
          }
          emptyMessage="لا توجد أساطيل بعد — ابدأ بإضافة جديد"
          renderItem={(fleet) => <Link href={`/fleets/${fleet.id}`} />}
        />
      )}
      <CreateFleetDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
