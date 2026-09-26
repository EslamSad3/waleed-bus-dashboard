"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createMarkaz,
  fetchGovernorates,
  fetchMarkazAll,
  updateMarkaz,
  type Governorate,
  type Markaz,
} from "@/lib/actions/trip-lines";
import { qk, upsertInList, useApiQuery, useQueryClient } from "@/lib/queries";

export default function MarkazPage() {
  const queryClient = useQueryClient();
  // الجدول بيعرض كل المراكز مع محافظتها — الفلتر بيتم بالمحافظة من القايمة أو من عمود الجدول أو الاتنين.
  const { data: rows, isLoading, error } = useApiQuery<Markaz[]>(qk.markazAll, () => fetchMarkazAll(true));
  const { data: governorates } = useApiQuery<Governorate[]>(qk.governorates, fetchGovernorates);
  const [governorateFilter, setGovernorateFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Markaz | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogGovernorateId, setDialogGovernorateId] = useState("");
  const [code, setCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  const filtered = useMemo(
    () => (rows ?? []).filter((m) => !governorateFilter || m.governorateId === governorateFilter),
    [rows, governorateFilter],
  );

  function openCreate() {
    setEditing(null);
    setDialogGovernorateId(governorateFilter || governorates?.[0]?.id || "");
    setCode("");
    setNameAr("");
    setNameEn("");
    setDialogError(null);
    setCreating(true);
  }

  function openEdit(markaz: Markaz) {
    setCreating(false);
    setEditing(markaz);
    setCode(markaz.code);
    setNameAr(markaz.nameAr);
    setNameEn(markaz.nameEn);
    setDialogError(null);
  }

  function closeDialog() {
    setCreating(false);
    setEditing(null);
    setDialogError(null);
  }

  async function save() {
    if (!creating) {
      if (!nameAr.trim() || !nameEn.trim()) {
        setDialogError("أكمل الاسم بالعربي والإنجليزي.");
        return;
      }
      setSaving(true);
      const result = await updateMarkaz(editing!.id, { nameAr: nameAr.trim(), nameEn: nameEn.trim() });
      setSaving(false);
      if (!result.ok) return setDialogError(result.message);
      upsertInList(queryClient, qk.markazAll, result.data);
      closeDialog();
      return;
    }
    if (!code.trim() || !nameAr.trim() || !nameEn.trim() || !dialogGovernorateId) {
      setDialogError("أكمل المحافظة والكود والاسم بالعربي والإنجليزي.");
      return;
    }
    setSaving(true);
    const result = await createMarkaz({
      governorateId: dialogGovernorateId,
      code: code.trim().toUpperCase(),
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim(),
    });
    setSaving(false);
    if (!result.ok) return setDialogError(result.message);
    upsertInList(queryClient, qk.markazAll, result.data);
    closeDialog();
  }

  async function toggleActive(markaz: Markaz) {
    const result = await updateMarkaz(markaz.id, { isActive: !markaz.isActive });
    if (!result.ok) return setDialogError(result.message);
    upsertInList(queryClient, qk.markazAll, result.data);
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
      field: "governorateId",
      headerName: "المحافظة",
      filter: "agTextColumnFilter",
      valueGetter: (params) => params.data?.governorate ? `${params.data.governorate.nameAr} · ${params.data.governorate.nameEn}` : "",
    },
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
          <p className="page-description">المركز/الحي تحت المحافظة — فلتر المحافظة متاح من القايمة أو من عمود الجدول، أو الاتنين مع بعض.</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> مركز جديد</Button>
      </div>
      <label className="mb-4 block max-w-sm text-sm">
        <span className="mb-1.5 block font-bold text-[#334454]">فلتر المحافظة</span>
        <select value={governorateFilter} onChange={(event) => setGovernorateFilter(event.target.value)} className="select-field w-full">
          <option value="">كل المحافظات</option>
          {(governorates ?? []).map((g) => <option key={g.id} value={g.id}>{g.nameAr} · {g.nameEn}</option>)}
        </select>
      </label>
      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p> : null}
      {isLoading ? <p className="text-sm text-slate-500">جاري التحميل…</p> : (
        <AgGridTable<Markaz>
          key={filtered.map((m) => `${m.id}:${m.code}:${m.isActive}`).join("|") || "empty"}
          gridId="markaz"
          rows={filtered}
          columnDefs={columns}
          emptyMessage="لا توجد مراكز مطابقة — ابدأ بإضافة أول مركز."
          getRowId={(m) => m.id}
        />
      )}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }} title={editing ? "تعديل المركز" : "مركز جديد"} description={editing ? "الكود والمحافظة ثابتين — عدّل الأسماء فقط." : "اختار المحافظة من القايمة، والكود إنجليزي بحروف كبيرة (مثال: BANHA)."} size="sm">
        <div className="space-y-4">
          {!editing ? (
            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">المحافظة</span>
              <select value={dialogGovernorateId} onChange={(event) => setDialogGovernorateId(event.target.value)} className="select-field w-full">
                <option value="">اختار المحافظة…</option>
                {(governorates ?? []).map((g) => <option key={g.id} value={g.id}>{g.nameAr} · {g.nameEn}</option>)}
              </select>
            </label>
          ) : null}
          {!editing ? <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الكود</span><Input dir="ltr" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="BANHA" /></label> : null}
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الاسم بالعربي</span><Input value={nameAr} onChange={(event) => setNameAr(event.target.value)} placeholder="بنها" /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الاسم بالإنجليزي</span><Input dir="ltr" value={nameEn} onChange={(event) => setNameEn(event.target.value)} placeholder="Banha" /></label>
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
