"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createVipTier, fetchVipTiers, updateVipTier, type VipTier } from "@/lib/actions/fleets";

export default function VipTiersPage() {
  const [rows, setRows] = useState<VipTier[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<VipTier | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [rank, setRank] = useState("1");

  useEffect(() => {
    fetchVipTiers(true).then((result) => {
      if (result.ok) setRows(result.data);
      else setError(result.message);
    });
  }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setRank(String((rows?.length ?? 0) + 1));
    setError(null);
    setCreating(true);
  }

  function openEdit(tier: VipTier) {
    setCreating(false);
    setEditing(tier);
    setName(tier.name);
    setRank(String(tier.rank));
    setError(null);
  }

  async function save() {
    if (!name.trim() || !rank) {
      setError("أدخل اسم المستوى والترتيب.");
      return;
    }
    setSaving(true);
    const result = editing
      ? await updateVipTier(editing.id, { name: name.trim(), rank: Number(rank) })
      : await createVipTier({ name: name.trim(), rank: Number(rank) });
    setSaving(false);
    if (!result.ok) return setError(result.message);
    if (editing) {
      setRows((items) => items?.map((t) => (t.id === result.data.id ? result.data : t)) ?? [result.data]);
      setEditing(null);
    } else {
      setRows((items) => [...(items ?? []), result.data].sort((a, b) => a.rank - b.rank));
      setCreating(false);
    }
    setError(null);
  }

  async function toggleActive(tier: VipTier) {
    const result = await updateVipTier(tier.id, { isActive: !tier.isActive });
    if (!result.ok) return setError(result.message);
    setRows((items) => items?.map((t) => (t.id === result.data.id ? result.data : t)) ?? []);
  }

  const dialogOpen = creating || editing !== null;

  const columns: CommunityColumnDef<VipTier>[] = [
    {
      field: "rank",
      headerName: "الترتيب",
      filter: "agNumberColumnFilter",
      cellRenderer: (params: { data?: VipTier }) => params.data ? <span className="font-bold">VIP {params.data.rank}<span className={params.data.isActive ? "mr-2 status-pill" : "mr-2 status-pill status-pill-muted"}>{params.data.isActive ? "نشط" : "موقوف"}</span></span> : null,
    },
    { field: "name", headerName: "الاسم" },
    {
      headerName: "إجراء",
      filter: false,
      sortable: false,
      exportable: false,
      cellRenderer: (params: { data?: VipTier }) => {
        const tier = params.data;
        if (!tier) return null;
        return (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(tier)}><Pencil className="size-4" /> تعديل</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => void toggleActive(tier)}>{tier.isActive ? "إيقاف" : "تفعيل"}</Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">مستويات VIP</h1>
          <p className="page-description">ترتيب ظهور ملاك الأساطيل في نتائج البحث — الأقل ترتيبًا يظهر أولًا.</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> مستوى جديد</Button>
      </div>
      {error && !dialogOpen ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {!rows ? <p className="text-sm text-slate-500">جاري التحميل…</p> : (
        <AgGridTable<VipTier>
          key={rows.map((t) => `${t.id}:${t.rank}:${t.isActive}`).join("|")}
          gridId="vip-tiers"
          rows={rows}
          columnDefs={columns}
          emptyMessage="لا توجد مستويات بعد — ابدأ بإضافة VIP 1."
          getRowId={(t) => t.id}
        />
      )}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setCreating(false); setEditing(null); setError(null); } }} title={editing ? "تعديل المستوى" : "مستوى جديد"} description="الترتيب رقم فريد — 1 يظهر أولًا." size="sm">
        <div className="space-y-4">
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الاسم</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="VIP 1" /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الترتيب</span><Input dir="ltr" inputMode="numeric" type="number" min={1} value={rank} onChange={(event) => setRank(event.target.value)} /></label>
          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2 border-t border-[#e4ecf2] pt-4"><Button type="button" variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>إلغاء</Button><Button type="button" onClick={() => void save()} disabled={saving}>{saving ? "جاري الحفظ…" : "حفظ"}</Button></div>
        </div>
      </Dialog>
    </div>
  );
}
