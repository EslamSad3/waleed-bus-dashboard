"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FleetBookingsTab, FleetBusesTab, FleetReportsTab, FleetTripsTab } from "@/components/fleets/fleet-detail-listings";
import { setFleetScopeCookie } from "@/lib/fleet-scope-cookie";
import { assignFleetVip, deleteFleet, fetchFleet, fetchVipTiers, updateFleet, type Fleet, type VipTier } from "@/lib/actions/fleets";
import { useFilterStore } from "@/stores/filters";
import { Dialog } from "@/components/ui/dialog";
import { Pencil } from "lucide-react";

const TABS = [
  { key: "overview", label: "نظرة عامة" },
  { key: "buses", label: "الأتوبيسات" },
  { key: "trips", label: "الرحلات" },
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
  const [tiers, setTiers] = useState<VipTier[]>([]);
  const [vipTierId, setVipTierId] = useState("");
  const [savingVip, setSavingVip] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    fetchFleet(id).then((r) => {
      if (r.ok) {
        setFleet(r.data);
        setName(r.data.name);
        setIsActive(r.data.isActive);
        setVipTierId(r.data.vipTierId ?? "");
      } else setFailed(r.message);
    });
    fetchVipTiers().then((r) => {
      if (r.ok) setTiers(r.data);
    });
  }, [id]);

  async function saveVip() {
    setError(null);
    setStatus(null);
    setSavingVip(true);
    const r = await assignFleetVip(id, vipTierId || null);
    setSavingVip(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setFleet(r.data);
    setVipTierId(r.data.vipTierId ?? "");
    setStatus("اتحفظ مستوى VIP بنجاح");
  }

  useEffect(() => {
    setFleetId(id);
    setFleetScopeCookie(id);
  }, [id, setFleetId]);

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
    setEditOpen(false);
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
    <div className="dashboard-page">
      <div className="page-heading">
        <div><h1 className="page-title">{fleet.name}</h1><p className="page-description">إدارة الأتوبيسات والرحلات والحجوزات والتشغيل المرتبط بالأسطول.</p></div>
        <span className={fleet.isActive ? "rounded-full bg-green-100 px-3 py-0.5 text-sm text-green-800" : "rounded-full bg-slate-200 px-3 py-0.5 text-sm text-slate-700"}>
          {fleet.isActive ? "نشط" : "موقوف"}
        </span>
      </div>

      <nav aria-label="تبويبات الأسطول" className="flex gap-2 overflow-x-auto pb-1">
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
        <div className="grid max-w-3xl gap-4 lg:grid-cols-2">
          <div className="panel-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#71808d]">اسم الأسطول</p>
                <p className="mt-1 text-lg font-bold text-[#17212b]">{fleet.name}</p>
                <span className={`mt-3 ${fleet.isActive ? "status-pill" : "status-pill status-pill-muted"}`}>{fleet.isActive ? "نشط" : "موقوف"}</span>
              </div>
              <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" aria-hidden="true" /> تعديل
              </Button>
            </div>
          </div>
          <div className="panel-card p-5 sm:p-6">
            <p className="text-xs font-semibold text-[#71808d]">مستوى VIP</p>
            <p className="mt-1 text-lg font-bold text-[#17212b]">{fleet.vipTier ? `VIP ${fleet.vipTier.rank} · ${fleet.vipTier.name}` : "بدون مستوى"}</p>
            <div className="mt-3 flex gap-2">
              <select aria-label="مستوى VIP" value={vipTierId} onChange={(e) => setVipTierId(e.target.value)} className="select-field min-w-0 flex-1">
                <option value="">بدون مستوى…</option>
                {tiers.map((tier) => <option key={tier.id} value={tier.id}>VIP {tier.rank} · {tier.name}{tier.isActive ? "" : " (موقوف)"}</option>)}
                {fleet?.vipTier && !tiers.some((t) => t.id === fleet.vipTier!.id) ? (
                  <option key={fleet.vipTier.id} value={fleet.vipTier.id}>VIP {fleet.vipTier.rank} · {fleet.vipTier.name} (موقوف)</option>
                ) : null}
              </select>
              <Button type="button" variant="secondary" onClick={saveVip} disabled={savingVip}>{savingVip ? "…" : "حفظ"}</Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="تعديل الأسطول" description="حدّث الاسم أو حالة تشغيل الأسطول." size="sm">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">اسم الأسطول</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 rounded-xl bg-[#f8fbfd] p-3 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[#2f719e]" />
            الأسطول نشط
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-between">
            <Button type="button" variant="destructive" onClick={remove}>مسح الأسطول</Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>إلغاء</Button>
              <Button type="button" onClick={save}>حفظ التعديلات</Button>
            </div>
          </div>
        </div>
      </Dialog>

      {tab === "buses" && <FleetBusesTab fleetId={id} />}
      {tab === "trips" && <FleetTripsTab fleetId={id} />}
      {tab === "bookings" && <FleetBookingsTab fleetId={id} />}
      {tab === "reports" && <FleetReportsTab fleetId={id} />}
    </div>
  );
}
