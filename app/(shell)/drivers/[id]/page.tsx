"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import {
  fetchDriver,
  removeDriver,
  updateDriver,
  MEMBER_STATUS_AR,
  type DriverRow,
  type Member,
} from "@/lib/actions/members";
import { useFilterStore } from "@/stores/filters";
import { qk, patchDetail, useApiQuery, useQueryClient } from "@/lib/queries";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { FleetPicker } from "@/components/fleet-picker";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
import { setFleetScopeCookie } from "@/lib/fleet-scope-cookie";
import { Pencil, Trash2 } from "lucide-react";
import { ImagePicker } from "@/components/ui/image-picker";
import { uploadUserPicture } from "@/lib/actions/users";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";

const REVOKE_WARNING = "الإجراء ده هيقفل جلسات المستخدم فورا — متأكد؟";
type DriverAssignment = NonNullable<DriverRow["assignments"]>[number];

export default function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const scopedFleetId = useFilterStore((s) => s.fleetId);
  const fleetId = searchParams.get("fleetId") || scopedFleetId;
  const setFleetId = useFilterStore((s) => s.setFleetId);
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [status, setStatus] = useState<Member["status"]>("ACTIVE");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  // TanStack cache: the driver detail is fetched through the query layer and
  // mutations patch the same cache slot — the view stays live after dialogs.
  const { data: driverData, error: driverError } = useApiQuery<DriverRow>(
    qk.driver(fleetId ?? "unknown", id),
    () => fetchDriver(fleetId!, id),
    { enabled: Boolean(fleetId) },
  );
  const fetchFailed = driverError?.message ?? null;
  const [seenDriver, setSeenDriver] = useState<DriverRow | null>(null);
  if (driverData && driverData !== seenDriver) {
    setSeenDriver(driverData);
    setDriver(driverData);
    if (driverData.status === "ACTIVE" || driverData.status === "SUSPENDED" || driverData.status === "REVOKED") {
      setStatus(driverData.status);
    }
  }

  function openEdit() {
    if (!driver) return;
    setName(driver.name ?? "");
    setNickname(driver.nickname ?? "");
    setPhone(driver.phoneNumber ?? "");
    setNationalId(driver.nationalId ?? "");
    setPassword("");
    setImageFile(null);
    setError(null);
    setEditOpen(true);
  }

  async function save() {
    if (!fleetId || !driver) return;
    setError(null);
    setNote(null);
    if (name.trim() === "") {
      setError("الاسم مطلوب.");
      return;
    }
    if (password && password.length < 8) {
      setError("كلمة السر لازم تبقى 8 حروف على الأقل.");
      return;
    }
    if (status !== "ACTIVE" && !(await confirm({ title: "تأكيد الإجراء", description: REVOKE_WARNING, confirmLabel: "تأكيد", destructive: true }))) return;
    setSaving(true);
    const r = await updateDriver(fleetId, id, {
      status,
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      phone: phone.trim() || undefined,
      nationalId: nationalId.trim() || undefined,
      ...(password ? { password } : {}),
    });
    if (!r.ok) {
      setSaving(false);
      setError(r.message);
      return;
    }
    // الصورة الجديدة بتترفع كملف FormData لحساب السواق
    if (imageFile) {
      const uploaded = await uploadUserPicture(driver.userId ?? driver.id, imageFile);
      if (!uploaded.ok) setError(uploaded.message);
    }
    const refreshed = await fetchDriver(fleetId, id);
    if (refreshed.ok) {
      setDriver(refreshed.data);
      patchDetail(queryClient, qk.driver(fleetId, id), refreshed.data);
    }
    setSaving(false);
    setNote("اتحفظ بنجاح");
    setEditOpen(false);
  }

  async function remove() {
    if (!fleetId) return;
    setError(null);
    setNote(null);
    if (!(await confirm({ title: "تأكيد المسح", description: `${REVOKE_WARNING} — تمسح السواق (بينهي العضوية والتعيين النشط)؟`, confirmLabel: "مسح", destructive: true }))) return;
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
  if (failed || fetchFailed) return <p role="alert" className="text-sm text-red-600">{failed ?? fetchFailed}</p>;
  if (!driver) return <DetailPageSkeleton sections={2} />;

  const assignmentColumns: CommunityColumnDef<DriverAssignment>[] = [
    { field: "plateNumber", headerName: "رقم اللوحة", filter: "agTextColumnFilter", valueFormatter: (params) => params.value || "—" },
    { field: "status", headerName: "الحالة", filter: "agTextColumnFilter" },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0"><h1 className="page-title">{driver.name ?? "السواق"}</h1><p className="page-description">بيانات الحساب وعضوية الأسطول وسجل تعيينات العربيات.</p></div>
        <AsyncButton type="button" variant="destructive" onClick={remove}><Trash2 className="size-4" /> حذف السواق</AsyncButton>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {note && <p role="status" className="text-sm text-green-700">{note}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel-card p-5 sm:p-6">
          <h2 className="section-title">العضوية</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex min-w-0 items-center justify-between gap-3"><dt className="shrink-0 text-[#606060]">اسم الشهرة</dt><dd className="min-w-0 truncate">{driver.nickname ?? "—"}</dd></div>
            <div className="flex min-w-0 items-center justify-between gap-3"><dt className="shrink-0 text-[#606060]">الموبايل</dt><dd className="min-w-0 truncate" dir="ltr">{driver.phoneNumber ?? "—"}</dd></div>
            <div className="flex min-w-0 items-center justify-between gap-3"><dt className="shrink-0 text-[#606060]">الرقم القومي</dt><dd className="min-w-0 truncate" dir="ltr">{driver.nationalId ?? "—"}</dd></div>
            <div className="flex min-w-0 items-center justify-between gap-3"><dt className="shrink-0 text-[#606060]">الدور</dt><dd className="min-w-0 truncate" dir="ltr">{driver.roleSlug ?? "—"}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <span className={status === "ACTIVE" ? "status-pill" : "status-pill status-pill-muted"}>{MEMBER_STATUS_AR[status]}</span>
            <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" aria-hidden="true" /> تعديل
            </Button>
          </div>
        </div>
        <div className="panel-card p-5 sm:p-6">
          <h2 className="section-title">سجل التعيينات</h2>
          <CursorList<DriverAssignment>
            gridId={`driver-assignments-${driver.id}`}
            initialItems={driver.assignments ?? []}
            initialCursor={null}
            loadMore={async () => ({ items: [], nextCursor: null })}
            keyOf={(assignment) => assignment.id}
            columnDefs={assignmentColumns}
            withActions={false}
            emptyMessage="لا توجد تعيينات مسجلة"
          />
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="تعديل بيانات السواق" description="حدّث بيانات الحساب كاملة — تغيير كلمة السر هيقفل جلساته الحالية." size="lg">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">الاسم بالكامل<span className="text-[#dc2626]"> *</span></span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="كريم علي" autoComplete="name" />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">اسم الشهرة</span>
            <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="كريم" />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">رقم الموبايل</span>
            <Input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" inputMode="tel" autoComplete="tel" />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">الرقم القومي</span>
            <Input dir="ltr" value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="14 رقم" inputMode="numeric" maxLength={14} />
          </label>
          <ImagePicker
            label="صورة السواق"
            file={imageFile}
            onChange={setImageFile}
            existingUrl={driver?.picture ?? null}
            uploading={saving && Boolean(imageFile)}
            hint="بتترفع كملف (FormData) للتخزين السحابي — من غير روابط."
          />
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">كلمة مرور جديدة <span className="font-normal text-slate-400">(اختياري)</span></span>
            <Input dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="اتركها فاضية من غير تغيير" autoComplete="new-password" />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">حالة العضوية</span>
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
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 md:col-span-2">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end md:col-span-2">
            <Button type="button" variant="danger" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <AsyncButton type="button" variant="success" onClick={save}>حفظ التعديلات</AsyncButton>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
