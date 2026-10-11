"use client";

import * as schemas from "@/lib/schemas/p1";

import { schemaErrors } from "@/lib/field-validation";

import { useFieldValidation } from "@/components/ui/field-validation";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RowActions } from "@/components/ui/row-actions";
import { TableSkeleton } from "@/components/ui/skeletons";
import { fetchGovernorates, updateGovernorate, type Governorate } from "@/lib/actions/trip-lines";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { applyMutationCache, referenceImpact } from "@/lib/cache/mutations";
import { t } from "@/lib/i18n/t";

/**
 * The built-in governorates. They are seeded by the API and can't be created
 * or deleted — only their names (mainly the English one) and code are edited.
 */
export default function GovernoratesPage() {
  const queryClient = useQueryClient();
  const { data: rows, isLoading, error } = useApiQuery<Governorate[]>(qk.governorates, fetchGovernorates);
  const [editing, setEditing] = useState<Governorate | null>(null);
  const [code, setCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  function openEdit(governorate: Governorate) {
    validation.reset();
    setEditing(governorate);
    setCode(governorate.code ?? "");
    setNameAr(governorate.nameAr);
    setNameEn(governorate.nameEn ?? "");
    setDialogError(null);
  }

  function closeDialog() {
    validation.reset();
    setEditing(null);
    setDialogError(null);
  }

  const validation = useFieldValidation(() => schemaErrors(schemas.updateGovernorateSchema, { nameAr: nameAr.trim(), nameEn: nameEn.trim(), code: code.trim() }));

  async function save() {
    if (!editing || !validation.validate()) return;
    const result = await updateGovernorate(editing.id, {
      code: code.trim() || null,
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || null,
    });
    if (!result.ok) return setDialogError(validation.failure(result));
    // Governorate names also show on the markaz, locality and stop screens.
    applyMutationCache(queryClient, referenceImpact(result.data.id, "governorates", "update"), result);
    closeDialog();
  }

  const columns: CommunityColumnDef<Governorate>[] = [
    {
      field: "code",
      headerName: t("common.fields.code"),
      cellRenderer: (params: { data?: Governorate }) => params.data ? <span className="font-bold" dir="auto">{params.data.code ?? "—"}</span> : null,
    },
    { field: "nameAr", headerName: t("markaz.columns.nameAr") },
    { field: "nameEn", headerName: t("markaz.columns.nameEn"), valueFormatter: (params) => (params.value as string | null) ?? "—" },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("governorates.title")}</h1>
          <p className="page-description">{t("governorates.description")}</p>
        </div>
      </div>
      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p> : null}
      {isLoading ? <TableSkeleton columns={4} /> : (
        <CursorList<Governorate>
          gridId="governorates"
          initialItems={rows ?? []}
          initialCursor={null}
          loadMore={async () => ({ items: [], nextCursor: null })}
          keyOf={(governorate) => governorate.id}
          columnDefs={columns}
          emptyMessage={t("governorates.empty")}
          renderItem={(governorate) => (
            <RowActions
              label={t("governorates.list.rowActions", { governorateNameAr: governorate.nameAr })}
              actions={[{ label: t("common.actions.edit"), icon: Pencil, onSelect: () => openEdit(governorate) }]}
            />
          )}
        />
      )}
      <Dialog validation={validation} open={editing !== null} onOpenChange={(open) => { if (!open) closeDialog(); }} title={t("governorates.dialog.editTitle")} description={t("governorates.dialog.description")} size="sm">
        <div className="space-y-4">
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.code")}</span><Input fieldName="code" dir="auto" value={code} onChange={(event) => setCode(event.target.value)} /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("localities.dialog.nameAr")}</span><Input fieldName="nameAr" value={nameAr} onChange={(event) => setNameAr(event.target.value)} /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.nameEn")} <span className="font-normal text-slate-400">{t("common.value.optional")}</span></span><Input fieldName="nameEn" dir="ltr" value={nameEn} onChange={(event) => setNameEn(event.target.value)} placeholder="Cairo" /><small className="mt-1 block text-xs text-[#687886]">{t("common.value.englishFallbackHint")}</small></label>
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
