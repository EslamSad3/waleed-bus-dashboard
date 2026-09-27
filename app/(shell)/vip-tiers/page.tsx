"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { TableSkeleton } from "@/components/ui/skeletons";
import { createVipTier, deleteVipTier, fetchVipTiers, updateVipTier, type VipTier } from "@/lib/actions/fleets";
import { rankOrdinalAr } from "@/lib/ordinals";
import { qk, removeFromList, upsertInList, useApiQuery, useQueryClient } from "@/lib/queries";

export default function VipTiersPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  // TanStack cache: edits land here instantly on dialog close — no reload.
  const { data: rows, isLoading, error } = useApiQuery<VipTier[]>(qk.vipTiers, () => fetchVipTiers(true));
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<VipTier | null>(null);
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
    const result = editing
      ? await updateVipTier(editing.id, { name: name.trim(), rank: Number(rank) })
      : await createVipTier({ name: name.trim(), rank: Number(rank) });
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

  async function removeTier(tier: VipTier) {
    if (!(await confirm({ title: "تأكيد المسح", description: `تمسح مستوى «${tier.name}»؟ لو فيه أساطيل مرتبطة بيه هتترفض العملية.`, confirmLabel: "مسح", destructive: true }))) return;
    const result = await deleteVipTier(tier.id);
    if (!result.ok) return setDialogError(result.message);
    removeFromList<VipTier>(queryClient, qk.vipTiers, tier.id);
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
        <div className="min-w-0 flex-1">
          <h1 className="page-title">مستويات VIP</h1>
          <p className="page-description">ترتيب ظهور أصحاب العربيات في نتائج البحث — الأقل ترتيبًا يظهر أولًا.</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> مستوى جديد</Button>
      </div>
      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p> : null}
      {isLoading ? <TableSkeleton columns={3} /> : (
        <CursorList<VipTier>
          gridId="vip-tiers"
          initialItems={rows ?? []}
          initialCursor={null}
          loadMore={async () => ({ items: [], nextCursor: null })}
          keyOf={(tier) => tier.id}
          columnDefs={columns}
          emptyMessage="لا توجد مستويات بعد — ابدأ بإضافة أول مستوى."
          renderItem={(tier) => (
            <RowActionsMenu
              label={`إجراءات مستوى ${tier.name}`}
              actions={[
                { label: "تعديل", onSelect: () => openEdit(tier) },
                { label: tier.isActive ? "إيقاف" : "تفعيل", onSelect: () => void toggleActive(tier) },
                { label: "مسح", danger: true, onSelect: () => void removeTier(tier) },
              ]}
            />
          )}
        />
      )}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }} title={editing ? "تعديل المستوى" : "مستوى جديد"} description="الترتيب رقم فريد — الأول في القائمه يظهر أولًا." size="sm">
        <div className="space-y-4">
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الاسم</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="ذهبي" /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الترتيب</span><Input dir="ltr" inputMode="numeric" type="number" min={1} value={rank} onChange={(event) => setRank(event.target.value)} /></label>
          {dialogError ? <p role="alert" className="text-sm text-red-600">{dialogError}</p> : null}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
            <Button type="button" variant="danger" onClick={closeDialog}>إلغاء</Button>
            <AsyncButton type="button" variant="success" onClick={save}>حفظ</AsyncButton>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
