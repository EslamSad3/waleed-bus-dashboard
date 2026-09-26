"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createLocality,
  fetchGovernorates,
  fetchLocalitiesAll,
  fetchMarkaz,
  updateLocality,
  type Governorate,
  type Locality,
  type Markaz,
} from "@/lib/actions/trip-lines";
import { qk, upsertInList, useApiQuery, useQueryClient } from "@/lib/queries";

const TYPE_LABEL: Record<string, string> = { CITY: "مدينة", VILLAGE: "قرية" };

export default function LocalitiesPage() {
  const queryClient = useQueryClient();
  const [governorateFilter, setGovernorateFilter] = useState("");
  const [markazFilter, setMarkazFilter] = useState("");

  // الجدول بيعرض كل المدن والقرى مع المركز والمحافظة — الفلتر من القوائم أو من أعمدة الجدول أو الاتنين.
  const { data: rows, isLoading, error } = useApiQuery<Locality[]>(
    qk.localitiesAll({}),
    () => fetchLocalitiesAll({ includeInactive: true }),
  );
  const { data: governorates } = useApiQuery<Governorate[]>(qk.governorates, fetchGovernorates);
  // مراكز فلتر المحافظة (قايمة متسلسلة)
  const { data: filterMarkazes } = useApiQuery<Markaz[]>(
    ["markaz", "filter", governorateFilter],
    () => fetchMarkaz(governorateFilter, true),
    { enabled: Boolean(governorateFilter) },
  );

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Locality | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogGovernorateId, setDialogGovernorateId] = useState("");
  const [dialogMarkazId, setDialogMarkazId] = useState("");
  const [type, setType] = useState<"CITY" | "VILLAGE">("CITY");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  // مراكز نافذة الإضافة — بتتحدث تلقائيًا بعد اختيار المحافظة
  const { data: dialogMarkazes } = useApiQuery<Markaz[]>(
    ["markaz", "dialog", dialogGovernorateId],
    () => fetchMarkaz(dialogGovernorateId, false),
    { enabled: Boolean(dialogGovernorateId) },
  );

  const filtered = useMemo(
    () =>
      (rows ?? []).filter((locality) => {
        if (governorateFilter && locality.markaz?.governorateId !== governorateFilter) return false;
        if (markazFilter && locality.markazId !== markazFilter) return false;
        return true;
      }),
    [rows, governorateFilter, markazFilter],
  );

  function openCreate() {
    setEditing(null);
    setDialogGovernorateId(governorateFilter || "");
    setDialogMarkazId(governorateFilter ? markazFilter : "");
    setType("CITY");
    setNameAr("");
    setNameEn("");
    setDialogError(null);
    setCreating(true);
  }

  function openEdit(locality: Locality) {
    setCreating(false);
    setEditing(locality);
    setType(locality.type);
    setNameAr(locality.nameAr);
    setNameEn(locality.nameEn);
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
      const result = await updateLocality(editing!.id, { nameAr: nameAr.trim(), nameEn: nameEn.trim() });
      setSaving(false);
      if (!result.ok) return setDialogError(result.message);
      upsertInList(queryClient, qk.localitiesAll({}), result.data);
      closeDialog();
      return;
    }
    if (!dialogMarkazId || !nameAr.trim() || !nameEn.trim()) {
      setDialogError("أكمل المحافظة والمركز والاسم بالعربي والإنجليزي.");
      return;
    }
    setSaving(true);
    const result = await createLocality({
      markazId: dialogMarkazId,
      type,
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim(),
    });
    setSaving(false);
    if (!result.ok) return setDialogError(result.message);
    upsertInList(queryClient, qk.localitiesAll({}), result.data);
    closeDialog();
  }

  async function toggleActive(locality: Locality) {
    const result = await updateLocality(locality.id, { isActive: !locality.isActive });
    if (!result.ok) return setDialogError(result.message);
    upsertInList(queryClient, qk.localitiesAll({}), result.data);
  }

  const dialogOpen = creating || editing !== null;

  const columns: CommunityColumnDef<Locality>[] = [
    {
      field: "nameAr",
      headerName: "الاسم",
      cellRenderer: (params: { data?: Locality }) => params.data ? <span className="font-bold">{params.data.nameAr} · {params.data.nameEn}<span className={params.data.isActive ? "mr-2 status-pill" : "mr-2 status-pill status-pill-muted"}>{params.data.isActive ? "نشطة" : "موقوفة"}</span></span> : null,
    },
    { headerName: "النوع", valueGetter: (params) => params.data ? TYPE_LABEL[params.data.type] ?? params.data.type : "", filter: "agTextColumnFilter" },
    {
      field: "markazId",
      headerName: "المركز",
      filter: "agTextColumnFilter",
      valueGetter: (params) => params.data?.markaz ? `${params.data.markaz.nameAr} · ${params.data.markaz.nameEn}` : "",
    },
    {
      headerName: "المحافظة",
      filter: "agTextColumnFilter",
      valueGetter: (params) => params.data?.markaz?.governorate ? `${params.data.markaz.governorate.nameAr} · ${params.data.markaz.governorate.nameEn}` : "",
    },
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
          <p className="page-description">المدينة/القرية تحت المركز — فلتر بالمحافظة أو بالمركز أو بالاتنين مع بعض.</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> منطقة جديدة</Button>
      </div>
      <div className="mb-4 grid max-w-2xl gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">فلتر المحافظة</span>
          <select
            value={governorateFilter}
            onChange={(event) => {
              setGovernorateFilter(event.target.value);
              setMarkazFilter("");
            }}
            className="select-field w-full"
          >
            <option value="">كل المحافظات</option>
            {(governorates ?? []).map((g) => <option key={g.id} value={g.id}>{g.nameAr} · {g.nameEn}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">فلتر المركز</span>
          <select value={markazFilter} onChange={(event) => setMarkazFilter(event.target.value)} className="select-field w-full" disabled={!governorateFilter}>
            <option value="">{governorateFilter ? "كل المراكز" : "اختار محافظة الأول…"}</option>
            {(filterMarkazes ?? []).map((m) => <option key={m.id} value={m.id}>{m.nameAr} · {m.nameEn}</option>)}
          </select>
        </label>
      </div>
      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p> : null}
      {isLoading ? <p className="text-sm text-slate-500">جاري التحميل…</p> : (
        <AgGridTable<Locality>
          key={filtered.map((l) => `${l.id}:${l.nameAr}:${l.isActive}`).join("|") || "empty"}
          gridId="localities"
          rows={filtered}
          columnDefs={columns}
          emptyMessage="لا توجد مناطق مطابقة — ابدأ بإضافة أول مدينة أو قرية."
          getRowId={(l) => l.id}
        />
      )}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }} title={editing ? "تعديل المنطقة" : "منطقة جديدة"} description={editing ? "المركز ثابت — عدّل الأسماء والنوع فقط." : "اختار المحافظة الأول، بعدها تظهر مراكزها في قايمة المركز."} size="sm">
        <div className="space-y-4">
          {!editing ? (
            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">المحافظة</span>
              <select
                value={dialogGovernorateId}
                onChange={(event) => {
                  setDialogGovernorateId(event.target.value);
                  setDialogMarkazId("");
                }}
                className="select-field w-full"
              >
                <option value="">اختار المحافظة…</option>
                {(governorates ?? []).map((g) => <option key={g.id} value={g.id}>{g.nameAr} · {g.nameEn}</option>)}
              </select>
            </label>
          ) : null}
          {!editing ? (
            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">المركز</span>
              <select
                value={dialogMarkazId}
                onChange={(event) => setDialogMarkazId(event.target.value)}
                className="select-field w-full"
                disabled={!dialogGovernorateId}
              >
                <option value="">{dialogGovernorateId ? "اختار المركز…" : "اختار محافظة الأول…"}</option>
                {(dialogMarkazes ?? []).map((m) => <option key={m.id} value={m.id}>{m.nameAr} · {m.nameEn}</option>)}
              </select>
            </label>
          ) : null}
          {!editing ? <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">النوع</span><select value={type} onChange={(event) => setType(event.target.value as "CITY" | "VILLAGE")} className="select-field w-full"><option value="CITY">مدينة</option><option value="VILLAGE">قرية</option></select></label> : null}
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
