"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

const REVOKE_WARNING = "الإجراء ده هيقفل جلسات المستخدم فورا — متأكد؟";

export default function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const fleetId = useFilterStore((s) => s.fleetId);
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<Member["status"]>("ACTIVE");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (!fleetId) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="title-grad text-2xl font-extrabold">السواق</h1>
        <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-[#606060]">اختار الأسطول الأول (x-fleet-id)</p>
      </div>
    );
  }
  if (failed && loadedKey === `${fleetId}/${id}`) return <p role="alert" className="text-sm text-red-600">{failed}</p>;
  if (!driver || loadedKey !== `${fleetId}/${id}`) return <p className="text-sm text-[#606060]">جاري التحميل…</p>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="title-grad text-2xl font-extrabold">{driver.name ?? "السواق"}</h1>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {note && <p role="status" className="text-sm text-green-700">{note}</p>}

      <div className="grid max-w-3xl gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-3 font-bold">العضوية</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-[#606060]">الموبايل</dt><dd dir="ltr">{driver.phone ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-[#606060]">الدور</dt><dd dir="ltr">{driver.roleSlug ?? "—"}</dd></div>
          </dl>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium">الحالة</span>
            <select
              aria-label="حالة السواق"
              value={status}
              onChange={(e) => setStatus(e.target.value as Member["status"])}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {(Object.keys(MEMBER_STATUS_AR) as Member["status"][]).map((s) => (
                <option key={s} value={s}>{MEMBER_STATUS_AR[s]}</option>
              ))}
            </select>
          </label>
          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={save}>حفظ</Button>
            <Button type="button" variant="destructive" onClick={remove}>مسح</Button>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-3 font-bold">سجل التعيينات</h2>
          {!driver.assignments || driver.assignments.length === 0 ? (
            <p className="text-sm text-[#606060]">لا توجد تعيينات مسجلة</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {driver.assignments.map((a) => (
                <li key={a.id} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span dir="ltr">{a.busId ?? a.id}</span>
                  <span className="text-[#606060]">{a.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
