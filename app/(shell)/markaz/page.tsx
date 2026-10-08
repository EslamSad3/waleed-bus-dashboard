"use client";

import { Select } from "@/components/ui/select";

import * as schemas from "@/lib/schemas/p1";

import { schemaErrors } from "@/lib/field-validation";

import { useFieldValidation } from "@/components/ui/field-validation";

import { useState } from "react";
import { Ban, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { activeStatusColumn } from "@/components/tables/status-column";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RowActions } from "@/components/ui/row-actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { TableSkeleton } from "@/components/ui/skeletons";
import {
  createMarkaz,
  deleteMarkaz,
  fetchGovernorates,
  fetchMarkazAll,
  updateMarkaz,
  type Governorate,
  type Markaz,
} from "@/lib/actions/trip-lines";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { applyMutationCache, referenceImpact } from "@/lib/cache/mutations";
import { t } from "@/lib/i18n/t";

export default function MarkazPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  // الجدول بيعرض كل المراكز مع محافظتها — الفلتر بيتم بالمحافظة من القايمة أو من عمود الجدول أو الاتنين.
  const { data: rows, isLoading, error } = useApiQuery<Markaz[]>(qk.markazAll, () => fetchMarkazAll(true));
  const { data: governorates } = useApiQuery<Governorate[]>(qk.governorates, fetchGovernorates);
  const [governorateFilter, setGovernorateFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Markaz | null>(null);
  const [dialogGovernorateId, setDialogGovernorateId] = useState("");
  const [code, setCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  // فلتر المحافظة — CursorList بيطبقه على الصفوف الظاهرة وصفحات "عرض المزيد"
  const filterPredicate = (markaz: Markaz) => !governorateFilter || markaz.governorateId === governorateFilter;

  function openCreate() {
    validation.reset();
    setEditing(null);
    setDialogGovernorateId(governorateFilter || governorates?.[0]?.id || "");
    setCode("");
    setNameAr("");
    setNameEn("");
    setDialogError(null);
    setCreating(true);
  }

  function openEdit(markaz: Markaz) {
    validation.reset();
    setCreating(false);
    setEditing(markaz);
    setDialogGovernorateId(markaz.governorateId);
    setCode(markaz.code ?? "");
    setNameAr(markaz.nameAr);
    setNameEn(markaz.nameEn ?? "");
    setDialogError(null);
  }

  function closeDialog() {
    validation.reset();
    setCreating(false);
    setEditing(null);
    setDialogError(null);
  }

  const validation = useFieldValidation(() => schemaErrors(creating ? schemas.createMarkazSchema : schemas.updateMarkazSchema, { nameAr: nameAr.trim(), nameEn: nameEn.trim(), code: code.trim(), governorateId: dialogGovernorateId }));

  async function save() {
    if (!validation.validate()) return;
    if (editing) {
      const result = await updateMarkaz(editing.id, {
        governorateId: dialogGovernorateId,
        code: code.trim() || null,
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim() || null,
      });
      if (!result.ok) return setDialogError(validation.failure(result));
      applyMutationCache(queryClient, referenceImpact(result.data.id, "markaz", "update"), result);
      closeDialog();
      return;
    }

    const result = await createMarkaz({
      governorateId: dialogGovernorateId,
      code: code.trim() || null,
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || null,
    });
    if (!result.ok) return setDialogError(validation.failure(result));
    applyMutationCache(queryClient, referenceImpact(result.data.id, "markaz", "insert"), result);
    closeDialog();
  }

  async function toggleActive(markaz: Markaz) {
    const result = await updateMarkaz(markaz.id, { isActive: !markaz.isActive });
    if (!result.ok) return setDialogError(result.message);
    applyMutationCache(queryClient, referenceImpact(result.data.id, "markaz", "update"), result);
  }

  async function removeMarkaz(markaz: Markaz) {
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("markaz.deleteConfirm.description", { markazNameAr: markaz.nameAr }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteMarkaz(markaz.id);
    if (!result.ok) return setDialogError(result.message);
    applyMutationCache(queryClient, referenceImpact(markaz.id, "markaz", "remove"), result);
  }

  const dialogOpen = creating || editing !== null;

  const columns: CommunityColumnDef<Markaz>[] = [
    {
      field: "code",
      headerName: t("common.fields.code"),
      cellRenderer: (params: { data?: Markaz }) => params.data ? <span className="font-bold" dir="auto">{params.data.code ?? "—"}</span> : null,
    },
    activeStatusColumn<Markaz>(),
    { field: "nameAr", headerName: t("markaz.columns.nameAr") },
    { field: "nameEn", headerName: t("markaz.columns.nameEn") },
    {
      field: "governorateId",
      headerName: t("common.fields.governorate"),
      filter: "agTextColumnFilter",
      valueGetter: (params) => params.data?.governorate ? `${params.data.governorate.nameAr}${params.data.governorate.nameEn ? ` · ${params.data.governorate.nameEn}` : ""}` : "",
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("markaz.title")}</h1>
          <p className="page-description">{t("markaz.description")}</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> {t("markaz.newMarkaz")}</Button>
      </div>
      <label className="mb-4 block max-w-sm text-sm">
        <span className="mb-1.5 block font-bold text-[#334454]">{t("markaz.filters.governorate")}</span>
        <Select fieldName="governorateFilter" value={governorateFilter} onChange={(event) => setGovernorateFilter(event.target.value)} className="select-field w-full">
          <option value="">{t("localities.filters.allGovernorates")}</option>
          {(governorates ?? []).map((g) => <option key={g.id} value={g.id}>{g.nameAr}{g.nameEn ? ` · ${g.nameEn}` : ""}</option>)}
        </Select>
      </label>
      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p> : null}
      {isLoading ? <TableSkeleton columns={6} /> : (
        <CursorList<Markaz>
          gridId="markaz"
          initialItems={rows ?? []}
          initialCursor={null}
          loadMore={async () => ({ items: [], nextCursor: null })}
          keyOf={(markaz) => markaz.id}
          filter={filterPredicate}
          columnDefs={columns}
          emptyMessage={t("markaz.empty")}
          renderItem={(markaz) => (
            <RowActions
              label={t("markaz.list.rowActions", { markazNameAr: markaz.nameAr })}
              actions={[
                { label: t("common.actions.edit"), icon: Pencil, onSelect: () => openEdit(markaz) },
                { label: markaz.isActive ? t("common.actions.disable") : t("common.actions.enable"), icon: markaz.isActive ? Ban : CheckCircle2, tone: markaz.isActive ? "warning" : "success", onSelect: () => void toggleActive(markaz) },
                { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void removeMarkaz(markaz) },
              ]}
            />
          )}
        />
      )}
      <Dialog validation={validation} open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }} title={editing ? t("markaz.dialog.editTitle") : t("markaz.dialog.createTitle")} description={editing ? t("markaz.dialog.description") : t("markaz.dialog.codeHint")} size="sm">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.governorate")}</span>
            <Select fieldName="governorateId" value={dialogGovernorateId} onChange={(event) => setDialogGovernorateId(event.target.value)} className="select-field w-full">
              <option value="">{t("localities.dialog.pickGovernorate")}</option>
              {(governorates ?? []).map((g) => <option key={g.id} value={g.id}>{g.nameAr}{g.nameEn ? ` · ${g.nameEn}` : ""}</option>)}
            </Select>
          </label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.code")}</span><Input fieldName="code" dir="auto" value={code} onChange={(event) => setCode(event.target.value)} /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("localities.dialog.nameAr")}</span><Input fieldName="nameAr" value={nameAr} onChange={(event) => setNameAr(event.target.value)} placeholder={t("localities.placeholders.nameAr")} /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("localities.dialog.nameEn")}</span><Input fieldName="nameEn" dir="auto" value={nameEn} onChange={(event) => setNameEn(event.target.value)} placeholder="Banha" /></label>
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
