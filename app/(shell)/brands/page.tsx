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
import { createBrand, deleteBrand, fetchBrands, updateBrand, type VehicleBrand } from "@/lib/actions/buses";
import { rankOrdinalAr } from "@/lib/ordinals";
import { qk, removeFromList, upsertInList, useApiQuery, useQueryClient } from "@/lib/queries";

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
      setDialogError("أدخل اسم الماركة.");
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
    if (!(await confirm({ title: "تأكيد المسح", description: `تمسح ماركة «${brand.name}»؟ لو فيها عربيات مسجلة هتترفض العملية.`, confirmLabel: "مسح", destructive: true }))) return;
    const result = await deleteBrand(brand.id);
    if (!result.ok) return setDialogError(result.message);
    removeFromList<VehicleBrand>(queryClient, qk.brands, brand.id);
  }

  const dialogOpen = creating || editing !== null;

  const columns: CommunityColumnDef<VehicleBrand>[] = [
    {
      field: "name",
      headerName: "الماركة",
      cellRenderer: (params: { data?: VehicleBrand }) => params.data ? <span className="font-bold">{params.data.name}<span className={params.data.isActive ? "mr-2 status-pill" : "mr-2 status-pill status-pill-muted"}>{params.data.isActive ? "نشطة" : "موقوفة"}</span></span> : null,
    },
    {
      field: "sortOrder",
      headerName: "الترتيب",
      filter: "agNumberColumnFilter",
      valueFormatter: (params) => rankOrdinalAr(params.value as number),
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">ماركات العربيات</h1>
          <p className="page-description">قاموس الماركات المتاحة عند تسجيل العربيات.</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> ماركة جديدة</Button>
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
          emptyMessage="لا توجد ماركات بعد — ابدأ بإضافة أول ماركة."
          renderItem={(brand) => (
            <RowActionsMenu
              label={`إجراءات ماركة ${brand.name}`}
              actions={[
                { label: "تعديل", onSelect: () => openEdit(brand) },
                { label: brand.isActive ? "إيقاف" : "تفعيل", onSelect: () => void toggleActive(brand) },
                { label: "مسح", danger: true, onSelect: () => void removeBrand(brand) },
              ]}
            />
          )}
        />
      )}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }} title={editing ? "تعديل الماركة" : "ماركة جديدة"} description="اسم فريد للماركة وترتيب ظهورها في القوائم." size="sm">
        <div className="space-y-4">
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الاسم</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Mercedes" /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">الترتيب</span><Input dir="ltr" inputMode="numeric" type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} /></label>
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
