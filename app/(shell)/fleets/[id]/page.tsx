"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MembersTab } from "@/components/fleets/members-tab";
import { setFleetScopeCookie } from "@/lib/fleet-scope-cookie";
import { deleteFleet, fetchFleet, updateFleet, type Fleet } from "@/lib/actions/fleets";
import { useFilterStore } from "@/stores/filters";

const TABS = [
  { key: "overview", label: "نظرة عامة" },
  { key: "buses", label: "الأتوبيسات" },
  { key: "trips", label: "الرحلات" },
  { key: "members", label: "الأعضاء" },
  { key: "bookings", label: "الحجوزات" },
  { key: "reports", label: "التقارير" },
] as const;

export default function FleetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const setFleetId = useFilterStore((s) => s.setFleetId);
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("overview");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFleet(id).then((r) => {
      if (r.ok) {
        setFleet(r.data);
        setName(r.data.name);
        setIsActive(r.data.isActive);
      } else setFailed(r.message);
    });
  }, [id]);

  function goScoped(href: string) {
    setFleetId(id);
    setFleetScopeCookie(id);
    router.push(href);
  }

  async function save() {
    setError(null);
    setStatus(null);
    const r = await updateFleet(id, { name, isActive });
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setFleet(r.data);
    setStatus("اتحفظ بنجاح");
  }

  async function remove() {
    setError(null);
    setStatus(null);
    if (!window.confirm("تأكيد المسح — الإجراء ده مينفعش يتراجع. تمسح الأسطول؟")) return;
    const r = await deleteFleet(id);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    router.push("/fleets");
    router.refresh();
  }

  if (failed) return <p role="alert" className="text-sm text-red-600">{failed}</p>;
  if (!fleet) return <p className="text-sm text-[#606060]">جاري التحميل…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="title-grad text-2xl font-extrabold">{fleet.name}</h1>
        <span className={fleet.isActive ? "rounded-full bg-green-100 px-3 py-0.5 text-sm text-green-800" : "rounded-full bg-slate-200 px-3 py-0.5 text-sm text-slate-700"}>
          {fleet.isActive ? "نشط" : "موقوف"}
        </span>
      </div>

      <nav aria-label="تبويبات الأسطول" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${tab === t.key ? "bg-[#2f719e] text-white" : "bg-white text-[#1a1a1a] hover:bg-[#daeaf5]"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="max-w-xl rounded-2xl bg-white p-6 shadow">
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">اسم الأسطول</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[#2f719e]" />
              نشط
            </label>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            {status && <p role="status" className="text-sm text-green-700">{status}</p>}
            <div className="flex gap-2">
              <Button type="button" onClick={save}>حفظ</Button>
              <Button type="button" variant="destructive" onClick={remove}>مسح الأسطول</Button>
            </div>
          </div>
        </div>
      )}

      {tab === "members" && <MembersTab fleetId={id} />}

      {tab !== "overview" && tab !== "members" && tab !== "reports" && (
        <div className="rounded-2xl bg-white p-6 text-center shadow">
          <p className="text-sm text-[#606060]">إدارة {TABS.find((t) => t.key === tab)?.label} الخاصة بالأسطول ده</p>
          <Button asChild className="mt-3">
            <button type="button" onClick={() => goScoped(`/${tab}`)}>فتح {TABS.find((t) => t.key === tab)?.label} (بنطاق الأسطول)</button>
          </Button>
        </div>
      )}

      {tab === "reports" && (
        <div className="rounded-2xl bg-[#daeaf5] p-6 text-center shadow">
          <p className="text-sm text-[#1a1a1a]">تقارير الأسطول (PDF) — قريبا في P3</p>
        </div>
      )}
    </div>
  );
}
