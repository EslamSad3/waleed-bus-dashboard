"use client";

import { useState } from "react";
import { Ban, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RowActions } from "@/components/ui/row-actions";
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
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { applyMutationCache, referenceImpact } from "@/lib/cache/mutations";
import { t } from "@/lib/i18n/t";

const TYPE_LABEL: Record<string, string> = { CITY: t("enums.localityType.city"), VILLAGE: t("enums.localityType.village") };

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
        setDialogError(t("localities.errors.nameRequired"));
        return;
      }
      const result = await updateLocality(editing!.id, { nameAr: nameAr.trim(), nameEn: nameEn.trim() });
      if (!result.ok) return setDialogError(result.message);
      applyMutationCache(queryClient, referenceImpact(result.data.id, "localities", "update"), result);
      closeDialog();
      return;
    }
    if (!dialogMarkazId || !nameAr.trim() || !nameEn.trim()) {
      setDialogError(t("localities.errors.hierarchyRequired"));
      return;
    }
    const result = await createLocality({
      markazId: dialogMarkazId,
      type,
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim(),
    });
    if (!result.ok) return setDialogError(result.message);
    applyMutationCache(queryClient, referenceImpact(result.data.id, "localities", "insert"), result);
    closeDialog();
  }

  async function toggleActive(locality: Locality) {
    const result = await updateLocality(locality.id, { isActive: !locality.isActive });
    if (!result.ok) return setDialogError(result.message);
    applyMutationCache(queryClient, referenceImpact(result.data.id, "localities", "update"), result);
  }

  async function removeLocality(locality: Locality) {
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("localities.deleteConfirm.description", { localityNameAr: locality.nameAr }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteLocality(locality.id);
    if (!result.ok) return setDialogError(result.message);
    applyMutationCache(queryClient, referenceImpact(locality.id, "localities", "remove"), result);
  }

  const dialogOpen = creating || editing !== null;

  const columns: CommunityColumnDef<Locality>[] = [
    {
      field: "nameAr",
      headerName: t("common.fields.name"),
      cellRenderer: (params: { data?: Locality }) => params.data ? <span className="font-bold">{params.data.nameAr} · {params.data.nameEn}<span className={params.data.isActive ? "mr-2 status-pill" : "mr-2 status-pill status-pill-muted"}>{params.data.isActive ? t("common.status.activeF") : t("common.status.inactiveF")}</span></span> : null,
    },
    { headerName: t("common.fields.type"), valueGetter: (params) => params.data ? TYPE_LABEL[params.data.type] ?? params.data.type : "", filter: "agTextColumnFilter" },
    {
      field: "markazId",
      headerName: t("common.fields.markaz"),
      filter: "agTextColumnFilter",
      valueGetter: (params) => params.data?.markaz ? `${params.data.markaz.nameAr} · ${params.data.markaz.nameEn}` : "",
    },
    {
      headerName: t("common.fields.governorate"),
      filter: "agTextColumnFilter",
      valueGetter: (params) => params.data?.markaz?.governorate ? `${params.data.markaz.governorate.nameAr} · ${params.data.markaz.governorate.nameEn}` : "",
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("localities.title")}</h1>
          <p className="page-description">{t("localities.description")}</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> {t("localities.newLocality")}</Button>
      </div>
      <div className="mb-4 grid max-w-2xl gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("localities.filters.governorate")}</span>
          <select
            value={governorateFilter}
            onChange={(event) => {
              setGovernorateFilter(event.target.value);
              setMarkazFilter("");
            }}
            className="select-field w-full"
          >
            <option value="">{t("localities.filters.allGovernorates")}</option>
            {(governorates ?? []).map((g) => <option key={g.id} value={g.id}>{g.nameAr} · {g.nameEn}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("localities.filters.markaz")}</span>
          <select value={markazFilter} onChange={(event) => setMarkazFilter(event.target.value)} className="select-field w-full" disabled={!governorateFilter}>
            <option value="">{governorateFilter ? t("localities.filters.allMarkaz") : t("localities.filters.pickGovernorateFirst")}</option>
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
          emptyMessage={t("localities.empty")}
          renderItem={(locality) => (
            <RowActions
              label={t("localities.list.rowActions", { localityNameAr: locality.nameAr })}
              actions={[
                { label: t("common.actions.edit"), icon: Pencil, onSelect: () => openEdit(locality) },
                { label: locality.isActive ? t("common.actions.disable") : t("common.actions.enable"), icon: locality.isActive ? Ban : CheckCircle2, tone: locality.isActive ? "warning" : "success", onSelect: () => void toggleActive(locality) },
                { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void removeLocality(locality) },
              ]}
            />
          )}
        />
      )}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }} title={editing ? t("localities.dialog.editTitle") : t("localities.dialog.createTitle")} description={editing ? t("localities.dialog.description") : t("localities.dialog.hierarchyHint")} size="sm">
        <div className="space-y-4">
          {!editing ? (
            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.governorate")}</span>
              <select
                value={dialogGovernorateId}
                onChange={(event) => {
                  setDialogGovernorateId(event.target.value);
                  setDialogMarkazId("");
                }}
                className="select-field w-full"
              >
                <option value="">{t("localities.dialog.pickGovernorate")}</option>
                {(governorates ?? []).map((g) => <option key={g.id} value={g.id}>{g.nameAr} · {g.nameEn}</option>)}
              </select>
            </label>
          ) : null}
          {!editing ? (
            <label className="block text-sm">
              <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.markaz")}</span>
              <select
                value={dialogMarkazId}
                onChange={(event) => setDialogMarkazId(event.target.value)}
                className="select-field w-full"
                disabled={!dialogGovernorateId}
              >
                <option value="">{dialogGovernorateId ? t("localities.dialog.pickMarkaz") : t("localities.dialog.pickGovernorateFirst")}</option>
                {(dialogMarkazes ?? []).map((m) => <option key={m.id} value={m.id}>{m.nameAr} · {m.nameEn}</option>)}
              </select>
            </label>
          ) : null}
          {!editing ? <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.type")}</span><select value={type} onChange={(event) => setType(event.target.value as "CITY" | "VILLAGE")} className="select-field w-full"><option value="CITY">{t("enums.localityType.city")}</option><option value="VILLAGE">{t("enums.localityType.village")}</option></select></label> : null}
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("localities.dialog.nameAr")}</span><Input value={nameAr} onChange={(event) => setNameAr(event.target.value)} placeholder={t("localities.placeholders.nameAr")} /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("localities.dialog.nameEn")}</span><Input dir="ltr" value={nameEn} onChange={(event) => setNameEn(event.target.value)} placeholder="Banha" /></label>
          {dialogError ? <p role="alert" className="text-sm text-red-600">{dialogError}</p> : null}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
            <Button type="button" variant="danger" onClick={closeDialog}>{t("common.actions.cancel")}</Button>
            <AsyncButton type="button" variant="success" onClick={save}>{t("common.actions.save")}</AsyncButton>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
