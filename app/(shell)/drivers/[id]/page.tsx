"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  fetchDriver,
  removeDriver,
  updateDriver,
  MEMBER_STATUS_AR,
  type DriverRow,
  type Member,
} from "@/lib/actions/members";
import { useFilterStore } from "@/stores/filters";
import { Dialog } from "@/components/ui/dialog";
import { FleetPicker } from "@/components/fleet-picker";
import { setFleetScopeCookie } from "@/lib/fleet-scope-cookie";
import { Pencil } from "lucide-react";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";

const REVOKE_WARNING = "الإجراء ده هيقفل جلسات المستخدم فورا — متأكد؟";
type DriverAssignment = NonNullable<DriverRow["assignments"]>[number];

export default function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const scopedFleetId = useFilterStore((s) => s.fleetId);
  const fleetId = searchParams.get("fleetId") || scopedFleetId;
  const setFleetId = useFilterStore((s) => s.setFleetId);
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<Member["status"]>("ACTIVE");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!fleetId) return;
    const key = `${fleetId}/${id}`;
    fetchDriver(fleetId, id).then((r) => {
      if (r.ok) {
        setDriver(r.data);
        if (r.data.status === "ACTIVE" || r.data.status === "SUSPENDED" || r.data.status === "REVOKED") {
          setStatus(r.data.status);
        }
        setFailed(null);
      } else setFailed(r.message);
      setLoadedKey(key);
    });
  }, [fleetId, id]);

  async function save() {
    if (!fleetId) return;
    setError(null);
    setNote(null);
    if (status !== "ACTIVE" && !window.confirm(REVOKE_WARNING)) return;
    const r = await updateDriver(fleetId, id, { status });
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setDriver(r.data);
    setNote("اتحفظ بنجاح");
    setEditOpen(false);
  }

  async function remove() {
    if (!fleetId) return;
    setError(null);
    setNote(null);
    if (!window.confirm(`${REVOKE_WARNING} تمسح السواق (بينهي العضوية والتعيين النشط)؟`)) return;
    const r = await removeDriver(fleetId, id);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    router.push("/drivers");
    router.refresh();
  }

  function selectFleet(nextFleetId: string) {
    setFleetId(nextFleetId || null);
    setFleetScopeCookie(nextFleetId || null);
  }

  if (!fleetId) {
    return (
      <div className="dashboard-page max-w-xl">
        <div>
          <h1 className="page-title">إدارة السواق</h1>
          <p className="page-description">اختار الأسطول الذي يتبعه السواق لعرض بياناته وإدارتها.</p>
        </div>
        <div className="panel-card p-5 sm:p-6">
          <FleetPicker value="" onChange={selectFleet} label="اختار الأسطول" />
        </div>
      </div>
    );
  }
  if (failed && loadedKey === `${fleetId}/${id}`) return <p role="alert" className="text-sm text-red-600">{failed}</p>;
  if (!driver || loadedKey !== `${fleetId}/${id}`) return <p className="text-sm text-[#606060]">جاري التحميل…</p>;

  const assignmentColumns: CommunityColumnDef<DriverAssignment>[] = [
    { field: "registrationNumber", headerName: "رقم التسجيل", filter: "agTextColumnFilter" },
    { field: "status", headerName: "الحالة", filter: "agTextColumnFilter" },
  ];

  return (
    <div className="dashboard-page">
      <div><h1 className="page-title">{driver.name ?? "السواق"}</h1><p className="page-description">بيانات الحساب وعضوية الأسطول وسجل تعيينات الأتوبيسات.</p></div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {note && <p role="status" className="text-sm text-green-700">{note}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel-card p-5 sm:p-6">
          <h2 className="section-title">العضوية</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-[#606060]">اسم الشهرة</dt><dd>{driver.nickname ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-[#606060]">الموبايل</dt><dd dir="ltr">{driver.phoneNumber ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-[#606060]">الرقم القومي</dt><dd dir="ltr">{driver.nationalId ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-[#606060]">الدور</dt><dd dir="ltr">{driver.roleSlug ?? "—"}</dd></div>
          </dl>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <span className={status === "ACTIVE" ? "status-pill" : "status-pill status-pill-muted"}>{MEMBER_STATUS_AR[status]}</span>
            <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" aria-hidden="true" /> تعديل أو حذف
            </Button>
          </div>
        </div>
        <div className="panel-card p-5 sm:p-6">
          <h2 className="section-title">سجل التعيينات</h2>
          <AgGridTable<DriverAssignment>
            gridId={`driver-assignments-${driver.id}`}
            rows={driver.assignments ?? []}
            columnDefs={assignmentColumns}
            emptyMessage="لا توجد تعيينات مسجلة"
            getRowId={(assignment) => assignment.id}
          />
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="إدارة السواق" description="يمكنك إيقاف حساب السواق أو إعادة تفعيله. الحذف ينهي تعيينه الحالي أيضًا." size="sm">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">الحالة</span>
            <select
              aria-label="حالة السواق"
              value={status}
              onChange={(e) => setStatus(e.target.value as Member["status"])}
              className="select-field w-full"
            >
              {(Object.keys(MEMBER_STATUS_AR) as Member["status"][]).map((s) => (
                <option key={s} value={s}>{MEMBER_STATUS_AR[s]}</option>
              ))}
            </select>
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-between">
            <Button type="button" variant="destructive" onClick={remove}>حذف السواق</Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>إلغاء</Button>
              <Button type="button" onClick={save}>حفظ التعديلات</Button>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
