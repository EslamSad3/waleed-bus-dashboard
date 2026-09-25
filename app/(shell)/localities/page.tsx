"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createLocality,
  fetchGovernorates,
  fetchLocalities,
  fetchMarkaz,
  updateLocality,
  type Governorate,
  type Locality,
  type Markaz,
} from "@/lib/actions/trip-lines";

const TYPE_LABEL: Record<string, string> = { CITY: "مدينة", VILLAGE: "قرية" };

export default function LocalitiesPage() {
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [governorateId, setGovernorateId] = useState("");
  const [markazes, setMarkazes] = useState<Markaz[]>([]);
  const [markazId, setMarkazId] = useState("");
  const [rows, setRows] = useState<Locality[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Locality | null>(null);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<"CITY" | "VILLAGE">("CITY");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");

  useEffect(() => {
    fetchGovernorates().then((result) => {
      if (!result.ok) return setError(result.message);
      setError(null);
      setGovernorates(result.data);
      if (result.data.length === 0) return;
      const firstGov = result.data[0].id;
      setGovernorateId(firstGov);
      fetchMarkaz(firstGov, true).then((markazResult) => {
        if (!markazResult.ok) return setError(markazResult.message);
        setError(null);
        setMarkazes(markazResult.data);
        if (markazResult.data.length === 0) return;
        const firstMarkaz = markazResult.data[0].id;
        setMarkazId(firstMarkaz);
        fetchLocalities(firstMarkaz, true).then((localityResult) => {
          if (localityResult.ok) { setRows(localityResult.data); setError(null); }
          else setError(localityResult.message);
        });
      });
    });
  }, []);

  function pickGovernorate(id: string) {
    setGovernorateId(id);
    setMarkazes([]);
    setMarkazId("");
    setRows([]);
    if (!id) return;
    fetchMarkaz(id, true).then((result) => {
      if (!result.ok) return setError(result.message);
      setError(null);
      setMarkazes(result.data);
      if (result.data.length === 0) return;
      const firstMarkaz = result.data[0].id;
      setMarkazId(firstMarkaz);
      fetchLocalities(firstMarkaz, true).then((localityResult) => {
        if (localityResult.ok) { setRows(localityResult.data); setError(null); }
        else setError(localityResult.message);
      });
    });
  }

  function pickMarkaz(id: string) {
    setMarkazId(id);
    setRows([]);
    if (!id) return;
    fetchLocalities(id, true).then((result) => {
      if (result.ok) { setRows(result.data); setError(null); }
      else setError(result.message);
    });
  }

  function openCreate() {
    setEditing(null);
    setType("CITY");
    setNameAr("");
    setNameEn("");
    setError(null);
    setCreating(true);
  }

  function openEdit(locality: Locality) {
    setCreating(false);
    setEditing(locality);
    setType(locality.type);
    setNameAr(locality.nameAr);
    setNameEn(locality.nameEn);
    setError(null);
  }

  async function save() {
    if (!nameAr.trim() || !nameEn.trim() || !markazId) {
      setError("أكمل الاسم بالعربي والإنجليزي.");
      return;
    }
    setSaving(true);
    const result = editing
      ? await updateLocality(editing.id, { nameAr: nameAr.trim(), nameEn: nameEn.trim() })
      : await createLocality({ markazId, type, nameAr: nameAr.trim(), nameEn: nameEn.trim() });
    setSaving(false);
    if (!result.ok) return setError(result.message);
    if (editing) {
      setRows((items) => items?.map((l) => (l.id === result.data.id ? result.data : l)) ?? [result.data]);
      setEditing(null);
    } else {
      setRows((items) => [...(items ?? []), result.data]);
      setCreating(false);
    }
    setError(null);
  }

  async function toggleActive(locality: Locality) {
    const result = await updateLocality(locality.id, { isActive: !locality.isActive });
    if (!result.ok) return setError(result.message);
    setRows((items) => items?.map((l) => (l.id === result.data.id ? result.data : l)) ?? []);
  }

  const dialogOpen = creating || editing !== null;

  const columns: CommunityColumnDef<Locality>[] = [
    {
      field: "nameAr",
      headerName: "الاسم",
      cellRenderer: (params: { data?: Locality }) => params.data ? <span className="font-bold">{params.data.nameAr} · {params.data.nameEn}<span className={params.data.isActive ? "mr-2 status-pill" : "mr-2 status-pill status-pill-muted"}>{params.data.isActive ? "نشطة" : "موقوفة"}</span></span> : null,
    },
    { headerName: "النوع", valueGetter: (params) => params.data ? TYPE_LABEL[params.data.type] ?? params.data.type : "" },
    {
      headerName: "إجراء",
      filter: false,
      sortable: false,
      exportable: false,
      cellRenderer: (params: { data?: Locality }) => {
        const locality = params.data;
        if (!locality) return null;
        return (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(locality)}><Pencil className="size-4" /> تعديل</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => void toggleActive(locality)}>{locality.isActive ? "إيقاف" : "تفعيل"}</Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">المدن والقرى</h1>
          <p className="page-description">المدينة/القرية تحت المركز — كل منطقة ممكن يبقى فيها كذا نقطة توقف.</p>
        </div>
        <Button onClick={openCreate} disabled={!markazId}><Plus className="size-4" /> منطقة جديدة</Button>
      </div>
      <div className="mb-4 grid max-w-2xl gap-3 sm:grid-cols-2">
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">المحافظة</span><select value={governorateId} onChange={(event) => pickGovernorate(event.target.value)} className="select-field w-full"><option value="">اختر المحافظة…</option>{governorates.map((g) => <option key={g.id} value={g.id}>{g.nameAr} · {g.nameEn}</option>)}</select></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">المركز</span><select value={markazId} onChange={(event) => pickMarkaz(event.target.value)} className="select-field w-full"><option value="">اختر المركز…</option>{markazes.map((m) => <option key={m.id} value={m.id}>{m.nameAr} · {m.nameEn}</option>)}</select></label>
      </div>
      {error && !dialogOpen ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {!rows ? <p className="text-sm text-slate-500">جاري التحميل…</p> : (
        <AgGridTable<Locality>
          key={rows.map((l) => `${l.id}:${l.nameAr}:${l.isActive}`).join("|")}
          gridId="localities"
          rows={rows}
          columnDefs={columns}
          emptyMessage="لا توجد مناطق في المركز ده — ابدأ بإضافة أول مدينة أو قرية."
          getRowId={(l) => l.id}
        />
      )}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setCreating(false); setEditing(null); setError(null); } }} title={editing ? "تعديل المنطقة" : "منطقة جديدة"} description="مدينة أو قرية تحت المركز المختار." size="sm">
        <div className="space-y-4">
          {!editing ? <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">النوع</span><select value={type} onChange={(event) => setType(event.target.value as "CITY" | "VILLAGE")} className="select-field w-full"><option value="CITY">مدينة</option><option value="VILLAGE">قرية</option></select></label> : null}
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الاسم بالعربي</span><Input value={nameAr} onChange={(event) => setNameAr(event.target.value)} placeholder="بنها" /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الاسم بالإنجليزي</span><Input dir="ltr" value={nameEn} onChange={(event) => setNameEn(event.target.value)} placeholder="Banha" /></label>
          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2 border-t border-[#e4ecf2] pt-4"><Button type="button" variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>إلغاء</Button><Button type="button" onClick={() => void save()} disabled={saving}>{saving ? "جاري الحفظ…" : "حفظ"}</Button></div>
        </div>
      </Dialog>
    </div>
  );
}
