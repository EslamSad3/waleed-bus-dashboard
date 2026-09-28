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
import { createBrand, deleteBrand, fetchBrands, updateBrand, type VehicleBrand } from "@/lib/actions/buses";
import { rankOrdinalAr } from "@/lib/ordinals";
import { qk, removeFromList, upsertInList, useApiQuery, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

export default function BrandsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: rows, isLoading, error } = useApiQuery<VehicleBrand[]>(qk.brands, () => fetchBrands(true));
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<VehicleBrand | null>(null);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [dialogError, setDialogError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setName("");
    setSortOrder("0");
    setDialogError(null);
    setCreating(true);
  }

  function openEdit(brand: VehicleBrand) {
    setCreating(false);
    setEditing(brand);
    setName(brand.name);
    setSortOrder(String(brand.sortOrder));
    setDialogError(null);
  }

  function closeDialog() {
    setCreating(false);
    setEditing(null);
    setDialogError(null);
  }

  async function save() {
    if (!name.trim()) {
      setDialogError(t("brands.errors.nameRequired"));
      return;
    }
    const result = editing
      ? await updateBrand(editing.id, { name: name.trim(), sortOrder: Number(sortOrder) || 0 })
      : await createBrand({ name: name.trim(), sortOrder: Number(sortOrder) || 0 });
    if (!result.ok) return setDialogError(result.message);
    upsertInList(queryClient, qk.brands, result.data);
    closeDialog();
  }

  async function toggleActive(brand: VehicleBrand) {
    const result = await updateBrand(brand.id, { isActive: !brand.isActive });
    if (!result.ok) return setDialogError(result.message);
    upsertInList(queryClient, qk.brands, result.data);
  }

  async function removeBrand(brand: VehicleBrand) {
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("brands.deleteConfirm.description", { brandName: brand.name }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteBrand(brand.id);
    if (!result.ok) return setDialogError(result.message);
    removeFromList<VehicleBrand>(queryClient, qk.brands, brand.id);
  }

  const dialogOpen = creating || editing !== null;

  const columns: CommunityColumnDef<VehicleBrand>[] = [
    {
      field: "name",
      headerName: t("common.fields.brand"),
      cellRenderer: (params: { data?: VehicleBrand }) => params.data ? <span className="font-bold">{params.data.name}<span className={params.data.isActive ? "mr-2 status-pill" : "mr-2 status-pill status-pill-muted"}>{params.data.isActive ? t("common.status.activeF") : t("common.status.inactiveF")}</span></span> : null,
    },
    {
      field: "sortOrder",
      headerName: t("common.fields.order"),
      filter: "agNumberColumnFilter",
      valueFormatter: (params) => rankOrdinalAr(params.value as number),
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("brands.title")}</h1>
          <p className="page-description">{t("brands.description")}</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> {t("brands.newBrand")}</Button>
      </div>
      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p> : null}
      {isLoading ? <TableSkeleton columns={3} /> : (
        <CursorList<VehicleBrand>
          gridId="brands"
          initialItems={rows ?? []}
          initialCursor={null}
          loadMore={async () => ({ items: [], nextCursor: null })}
          keyOf={(brand) => brand.id}
          columnDefs={columns}
          emptyMessage={t("brands.empty")}
          renderItem={(brand) => (
            <RowActions
              label={t("brands.rowActions", { brandName: brand.name })}
              actions={[
                { label: t("common.actions.edit"), icon: Pencil, onSelect: () => openEdit(brand) },
                { label: brand.isActive ? t("common.actions.disable") : t("common.actions.enable"), icon: brand.isActive ? Ban : CheckCircle2, tone: brand.isActive ? "warning" : "success", onSelect: () => void toggleActive(brand) },
                { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void removeBrand(brand) },
              ]}
            />
          )}
        />
      )}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }} title={editing ? t("brands.dialog.editTitle") : t("brands.dialog.createTitle")} description={t("brands.dialog.description")} size="sm">
        <div className="space-y-4">
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.name")}</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Mercedes" /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.order")}</span><Input dir="ltr" inputMode="numeric" type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} /></label>
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
