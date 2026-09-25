"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createMarkaz,
  fetchGovernorates,
  fetchMarkaz,
  updateMarkaz,
  type Governorate,
  type Markaz,
} from "@/lib/actions/trip-lines";

export default function MarkazPage() {
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [governorateId, setGovernorateId] = useState("");
  const [rows, setRows] = useState<Markaz[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Markaz | null>(null);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");

  useEffect(() => {
    fetchGovernorates().then((result) => {
      if (!result.ok) return setError(result.message);
      setGovernorates(result.data);
      if (result.data.length === 0) return;
      setGovernorateId(result.data[0].id);
      fetchMarkaz(result.data[0].id, true).then((markazResult) => {
        if (markazResult.ok) setRows(markazResult.data);
        else setError(markazResult.message);
      });
    });
  }, []);

  function pickGovernorate(id: string) {
    setGovernorateId(id);
    if (!id) {
      setRows([]);
      return;
    }
    fetchMarkaz(id, true).then((result) =>
      result.ok ? setRows(result.data) : setError(result.message),
    );
  }

  function openCreate() {
    setEditing(null);
    setCode("");
    setNameAr("");
    setNameEn("");
    setError(null);
    setCreating(true);
  }

  function openEdit(markaz: Markaz) {
    setCreating(false);
    setEditing(markaz);
    setCode(markaz.code);
    setNameAr(markaz.nameAr);
    setNameEn(markaz.nameEn);
    setError(null);
  }

  async function save() {
    if (!code.trim() || !nameAr.trim() || !nameEn.trim() || !governorateId) {
      setError("أكمل الكود والاسم بالعربي والإنجليزي.");
      return;
    }
    setSaving(true);
    const result = editing
      ? await updateMarkaz(editing.id, { nameAr: nameAr.trim(), nameEn: nameEn.trim() })
      : await createMarkaz({ governorateId, code: code.trim().toUpperCase(), nameAr: nameAr.trim(), nameEn: nameEn.trim() });
    setSaving(false);
    if (!result.ok) return setError(result.message);
    if (editing) {
      setRows((items) => items?.map((m) => (m.id === result.data.id ? result.data : m)) ?? [result.data]);
      setEditing(null);
    } else {
      setRows((items) => [...(items ?? []), result.data]);
      setCreating(false);
    }
    setError(null);
  }

  async function toggleActive(markaz: Markaz) {
    const result = await updateMarkaz(markaz.id, { isActive: !markaz.isActive });
    if (!result.ok) return setError(result.message);
    setRows((items) => items?.map((m) => (m.id === result.data.id ? result.data : m)) ?? []);
  }

  const dialogOpen = creating || editing !== null;

  const columns: CommunityColumnDef<Markaz>[] = [
    {
      field: "code",
      headerName: "الكود",
      cellRenderer: (params: { data?: Markaz }) => params.data ? <span className="font-bold" dir="ltr">{params.data.code}<span className={params.data.isActive ? "mr-2 status-pill" : "mr-2 status-pill status-pill-muted"}>{params.data.isActive ? "نشط" : "موقوف"}</span></span> : null,
    },
    { field: "nameAr", headerName: "الاسم (عربي)" },
    { field: "nameEn", headerName: "الاسم (إنجليزي)" },
    {
      headerName: "إجراء",
      filter: false,
      sortable: false,
      exportable: false,
      cellRenderer: (params: { data?: Markaz }) => {
        const markaz = params.data;
        if (!markaz) return null;
        return (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(markaz)}><Pencil className="size-4" /> تعديل</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => void toggleActive(markaz)}>{markaz.isActive ? "إيقاف" : "تفعيل"}</Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">المراكز</h1>
          <p className="page-description">المركز/الحي تحت المحافظة — الخطوة الثانية في التسلسل الجغرافي.</p>
        </div>
        <Button onClick={openCreate} disabled={!governorateId}><Plus className="size-4" /> مركز جديد</Button>
      </div>
      <label className="mb-4 block max-w-sm text-sm"><span className="mb-1.5 block font-bold text-[#334454]">المحافظة</span><select value={governorateId} onChange={(event) => pickGovernorate(event.target.value)} className="select-field w-full"><option value="">اختر المحافظة…</option>{governorates.map((g) => <option key={g.id} value={g.id}>{g.nameAr} · {g.nameEn}</option>)}</select></label>
      {error && !dialogOpen ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {!rows ? <p className="text-sm text-slate-500">جاري التحميل…</p> : (
        <AgGridTable<Markaz>
          key={rows.map((m) => `${m.id}:${m.code}:${m.isActive}`).join("|")}
          gridId="markaz"
          rows={rows}
          columnDefs={columns}
          emptyMessage="لا توجد مراكز في المحافظة دي — ابدأ بإضافة أول مركز."
          getRowId={(m) => m.id}
        />
      )}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setCreating(false); setEditing(null); setError(null); } }} title={editing ? "تعديل المركز" : "مركز جديد"} description="الكود إنجليزي وحروف كبيرة (مثال: BANHA)." size="sm">
        <div className="space-y-4">
          {!editing ? <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الكود</span><Input dir="ltr" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="BANHA" /></label> : null}
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الاسم بالعربي</span><Input value={nameAr} onChange={(event) => setNameAr(event.target.value)} placeholder="بنها" /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الاسم بالإنجليزي</span><Input dir="ltr" value={nameEn} onChange={(event) => setNameEn(event.target.value)} placeholder="Banha" /></label>
          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2 border-t border-[#e4ecf2] pt-4"><Button type="button" variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>إلغاء</Button><Button type="button" onClick={() => void save()} disabled={saving}>{saving ? "جاري الحفظ…" : "حفظ"}</Button></div>
        </div>
      </Dialog>
    </div>
  );
}
