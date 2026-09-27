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
import {
  createLocality,
  deleteLocality,
  fetchGovernorates,
  fetchLocalitiesAll,
  fetchMarkaz,
  updateLocality,
  type Governorate,
  type Locality,
  type Markaz,
} from "@/lib/actions/trip-lines";
import { qk, removeFromList, upsertInList, useApiQuery, useQueryClient } from "@/lib/queries";

const TYPE_LABEL: Record<string, string> = { CITY: "مدينة", VILLAGE: "قرية" };

export default function LocalitiesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
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

  // فلاتر المحافظة والمركز — CursorList بيطبقها على الصفوف الظاهرة
  const filterPredicate = (locality: Locality) => {
    if (governorateFilter && locality.markaz?.governorateId !== governorateFilter) return false;
    if (markazFilter && locality.markazId !== markazFilter) return false;
    return true;
  };

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
      const result = await updateLocality(editing!.id, { nameAr: nameAr.trim(), nameEn: nameEn.trim() });
      if (!result.ok) return setDialogError(result.message);
      upsertInList(queryClient, qk.localitiesAll({}), result.data);
      closeDialog();
      return;
    }
    if (!dialogMarkazId || !nameAr.trim() || !nameEn.trim()) {
      setDialogError("أكمل المحافظة والمركز والاسم بالعربي والإنجليزي.");
      return;
    }
    const result = await createLocality({
      markazId: dialogMarkazId,
      type,
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim(),
    });
    if (!result.ok) return setDialogError(result.message);
    upsertInList(queryClient, qk.localitiesAll({}), result.data);
    closeDialog();
  }

  async function toggleActive(locality: Locality) {
    const result = await updateLocality(locality.id, { isActive: !locality.isActive });
    if (!result.ok) return setDialogError(result.message);
    upsertInList(queryClient, qk.localitiesAll({}), result.data);
  }

  async function removeLocality(locality: Locality) {
    if (!(await confirm({ title: "تأكيد المسح", description: `تمسح «${locality.nameAr}»؟ لو عليها مواقف مسجلة هتترفض العملية.`, confirmLabel: "مسح", destructive: true }))) return;
    const result = await deleteLocality(locality.id);
    if (!result.ok) return setDialogError(result.message);
    removeFromList<Locality>(queryClient, qk.localitiesAll({}), locality.id);
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
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
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
      {isLoading ? <TableSkeleton columns={5} /> : (
        <CursorList<Locality>
          gridId="localities"
          initialItems={rows ?? []}
          initialCursor={null}
          loadMore={async () => ({ items: [], nextCursor: null })}
          keyOf={(locality) => locality.id}
          filter={filterPredicate}
          columnDefs={columns}
          emptyMessage="لا توجد مناطق مطابقة — ابدأ بإضافة أول مدينة أو قرية."
          renderItem={(locality) => (
            <RowActionsMenu
              label={`إجراءات ${locality.nameAr}`}
              actions={[
                { label: "تعديل", onSelect: () => openEdit(locality) },
                { label: locality.isActive ? "إيقاف" : "تفعيل", onSelect: () => void toggleActive(locality) },
                { label: "مسح", danger: true, onSelect: () => void removeLocality(locality) },
              ]}
            />
          )}
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
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
            <Button type="button" variant="danger" onClick={closeDialog}>إلغاء</Button>
            <AsyncButton type="button" variant="success" onClick={save}>حفظ</AsyncButton>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
