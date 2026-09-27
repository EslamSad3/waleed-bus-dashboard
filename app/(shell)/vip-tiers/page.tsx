"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createVipTier, fetchVipTiers, updateVipTier, type VipTier } from "@/lib/actions/fleets";
import { rankOrdinalAr } from "@/lib/ordinals";
import { qk, upsertInList, useApiQuery, useQueryClient } from "@/lib/queries";

export default function VipTiersPage() {
  const queryClient = useQueryClient();
  // TanStack cache: edits land here instantly on dialog close — no reload.
  const { data: rows, isLoading, error } = useApiQuery<VipTier[]>(qk.vipTiers, () => fetchVipTiers(true));
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<VipTier | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [rank, setRank] = useState("1");
  const [dialogError, setDialogError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setName("");
    setRank(String((rows?.length ?? 0) + 1));
    setDialogError(null);
    setCreating(true);
  }

  function openEdit(tier: VipTier) {
    setCreating(false);
    setEditing(tier);
    setName(tier.name);
    setRank(String(tier.rank));
    setDialogError(null);
  }

  function closeDialog() {
    setCreating(false);
    setEditing(null);
    setDialogError(null);
  }

  async function save() {
    if (!name.trim() || !rank) {
      setDialogError("أدخل اسم المستوى والترتيب.");
      return;
    }
    setSaving(true);
    const result = editing
      ? await updateVipTier(editing.id, { name: name.trim(), rank: Number(rank) })
      : await createVipTier({ name: name.trim(), rank: Number(rank) });
    setSaving(false);
    if (!result.ok) return setDialogError(result.message);
    // Instant cache write → الجدول بيتحدث في نفس اللحظة.
    upsertInList(queryClient, qk.vipTiers, result.data);
    queryClient.invalidateQueries({ queryKey: qk.vipTiers });
    closeDialog();
  }

  async function toggleActive(tier: VipTier) {
    const result = await updateVipTier(tier.id, { isActive: !tier.isActive });
    if (!result.ok) return setDialogError(result.message);
    upsertInList(queryClient, qk.vipTiers, result.data);
  }

  const dialogOpen = creating || editing !== null;

  const columns: CommunityColumnDef<VipTier>[] = [
    {
      field: "rank",
      headerName: "الترتيب",
      filter: "agNumberColumnFilter",
      valueFormatter: (params) => rankOrdinalAr(params.value as number),
      cellRenderer: (params: { data?: VipTier }) => params.data ? <span className="font-bold">{rankOrdinalAr(params.data.rank)}<span className={params.data.isActive ? "mr-2 status-pill" : "mr-2 status-pill status-pill-muted"}>{params.data.isActive ? "نشط" : "موقوف"}</span></span> : null,
    },
    { field: "name", headerName: "الاسم" },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">مستويات VIP</h1>
          <p className="page-description">ترتيب ظهور أصحاب العربيات في نتائج البحث — الأقل ترتيبًا يظهر أولًا.</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> مستوى جديد</Button>
      </div>
      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p> : null}
      {isLoading ? <p className="text-sm text-slate-500">جاري التحميل…</p> : (
        <CursorList<VipTier>
          gridId="vip-tiers"
          initialItems={rows ?? []}
          initialCursor={null}
          loadMore={async () => ({ items: [], nextCursor: null })}
          keyOf={(tier) => tier.id}
          columnDefs={columns}
          emptyMessage="لا توجد مستويات بعد — ابدأ بإضافة أول مستوى."
          renderItem={(tier) => (
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(tier)}><Pencil className="size-4" /> تعديل</Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => void toggleActive(tier)}>{tier.isActive ? "إيقاف" : "تفعيل"}</Button>
            </div>
          )}
        />
      )}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }} title={editing ? "تعديل المستوى" : "مستوى جديد"} description="الترتيب رقم فريد — الأول في القائمه يظهر أولًا." size="sm">
        <div className="space-y-4">
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الاسم</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="ذهبي" /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الترتيب</span><Input dir="ltr" inputMode="numeric" type="number" min={1} value={rank} onChange={(event) => setRank(event.target.value)} /></label>
          {dialogError ? <p role="alert" className="text-sm text-red-600">{dialogError}</p> : null}
          <div className="flex gap-2 border-t border-[#e4ecf2] pt-4">
            <Button type="button" variant="danger" onClick={closeDialog}>إلغاء</Button>
            <Button type="button" variant="success" onClick={() => void save()} disabled={saving}>{saving ? "جاري الحفظ…" : "حفظ"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
