"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createBrand, fetchBrands, updateBrand, type VehicleBrand } from "@/lib/actions/buses";

export default function BrandsPage() {
  const [rows, setRows] = useState<VehicleBrand[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<VehicleBrand | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  useEffect(() => {
    fetchBrands(true).then((result) => {
      if (result.ok) setRows(result.data);
      else setError(result.message);
    });
  }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setSortOrder("0");
    setError(null);
    setCreating(true);
  }

  function openEdit(brand: VehicleBrand) {
    setCreating(false);
    setEditing(brand);
    setName(brand.name);
    setSortOrder(String(brand.sortOrder));
    setError(null);
  }

  async function save() {
    if (!name.trim()) {
      setError("أدخل اسم الماركة.");
      return;
    }
    setSaving(true);
    const result = editing
      ? await updateBrand(editing.id, { name: name.trim(), sortOrder: Number(sortOrder) || 0 })
      : await createBrand({ name: name.trim(), sortOrder: Number(sortOrder) || 0 });
    setSaving(false);
    if (!result.ok) return setError(result.message);
    if (editing) {
      setRows((items) => items?.map((b) => (b.id === result.data.id ? result.data : b)) ?? [result.data]);
      setEditing(null);
    } else {
      setRows((items) => [...(items ?? []), result.data]);
      setCreating(false);
    }
    setError(null);
  }

  async function toggleActive(brand: VehicleBrand) {
    const result = await updateBrand(brand.id, { isActive: !brand.isActive });
    if (!result.ok) return setError(result.message);
    setRows((items) => items?.map((b) => (b.id === result.data.id ? result.data : b)) ?? []);
  }

  const dialogOpen = creating || editing !== null;

  const columns: CommunityColumnDef<VehicleBrand>[] = [
    {
      field: "name",
      headerName: "الماركة",
      cellRenderer: (params: { data?: VehicleBrand }) => params.data ? <span className="font-bold">{params.data.name}<span className={params.data.isActive ? "mr-2 status-pill" : "mr-2 status-pill status-pill-muted"}>{params.data.isActive ? "نشطة" : "موقوفة"}</span></span> : null,
    },
    { field: "sortOrder", headerName: "الترتيب", filter: "agNumberColumnFilter" },
    {
      headerName: "إجراء",
      filter: false,
      sortable: false,
      exportable: false,
      cellRenderer: (params: { data?: VehicleBrand }) => {
        const brand = params.data;
        if (!brand) return null;
        return (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(brand)}><Pencil className="size-4" /> تعديل</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => void toggleActive(brand)}>{brand.isActive ? "إيقاف" : "تفعيل"}</Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">ماركات الأتوبيسات</h1>
          <p className="page-description">قاموس الماركات المتاحة عند تسجيل الأتوبيسات.</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> ماركة جديدة</Button>
      </div>
      {error && !dialogOpen ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {!rows ? <p className="text-sm text-slate-500">جاري التحميل…</p> : (
        <AgGridTable<VehicleBrand>
          key={rows.map((b) => `${b.id}:${b.name}:${b.isActive}`).join("|")}
          gridId="brands"
          rows={rows}
          columnDefs={columns}
          emptyMessage="لا توجد ماركات بعد — ابدأ بإضافة أول ماركة."
          getRowId={(b) => b.id}
        />
      )}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setCreating(false); setEditing(null); setError(null); } }} title={editing ? "تعديل الماركة" : "ماركة جديدة"} description="اسم فريد للماركة وترتيب ظهورها في القوائم." size="sm">
        <div className="space-y-4">
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الاسم</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Mercedes" /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الترتيب</span><Input dir="ltr" inputMode="numeric" type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} /></label>
          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2 border-t border-[#e4ecf2] pt-4"><Button type="button" variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>إلغاء</Button><Button type="button" onClick={() => void save()} disabled={saving}>{saving ? "جاري الحفظ…" : "حفظ"}</Button></div>
        </div>
      </Dialog>
    </div>
  );
}
