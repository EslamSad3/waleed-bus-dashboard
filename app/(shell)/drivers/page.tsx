"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchSystemDriversPage, MEMBER_STATUS_AR, type SystemDriverRow } from "@/lib/actions/members";

export default function DriversPage() {
  const [drivers, setDrivers] = useState<SystemDriverRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  async function load(cursor: string | null = null) {
    cursor ? setLoadingMore(true) : setLoading(true);
    setError(null);
    const result = await fetchSystemDriversPage(cursor);
    if (!result.ok) {
      setError(result.message);
    } else {
      setDrivers((current) => cursor ? [...current, ...result.data.items] : result.data.items);
      setNextCursor(result.data.nextCursor);
    }
    cursor ? setLoadingMore(false) : setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const visibleDrivers = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("ar-EG");
    return drivers.filter((driver) => {
      const matchesSearch = !term || [
        driver.name,
        driver.phoneNumber,
        driver.fleet.name,
        driver.fleetOwner.name,
        driver.fleetOwner.phoneNumber,
        driver.assignedBus?.registrationNumber,
      ].some((value) => value?.toLocaleLowerCase("ar-EG").includes(term));
      return matchesSearch && (status === "all" || driver.status === status);
    });
  }, [drivers, query, status]);

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">السواقين</h1>
          <p className="page-description">كل حسابات السواقين في النظام، مع الأسطول ومالك الأسطول والأتوبيس المعيّن حاليًا.</p>
        </div>
        <Button asChild><Link href="/drivers/new">إضافة سواق</Link></Button>
      </div>

      <div className="panel-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <Input aria-label="بحث في السواقين" placeholder="اسم السواق، الموبايل، المالك أو الأتوبيس" value={query} onChange={(event) => setQuery(event.target.value)} className="max-w-md bg-white" />
        <select aria-label="حالة السواق" value={status} onChange={(event) => setStatus(event.target.value)} className="select-field w-full sm:w-auto">
          <option value="all">كل الحالات</option>
          <option value="ACTIVE">نشط</option>
          <option value="SUSPENDED">موقوف</option>
          <option value="REVOKED">ملغي الصلاحية</option>
        </select>
      </div>

      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-[#606060]">جاري تحميل السواقين…</p> : (
        <div className="panel-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-right text-sm">
              <thead className="border-b border-[#e4ecf2] bg-[#f8fbfd] text-[#5e6b78]">
                <tr>
                  <th className="px-5 py-4 font-bold">السواق</th>
                  <th className="px-5 py-4 font-bold">الأسطول</th>
                  <th className="px-5 py-4 font-bold">مالك الأسطول</th>
                  <th className="px-5 py-4 font-bold">الأتوبيس المعيّن</th>
                  <th className="px-5 py-4 font-bold">الحالة</th>
                  <th className="px-5 py-4 font-bold"><span className="sr-only">إدارة السواق</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf2f6]">
                {visibleDrivers.map((driver) => (
                  <tr key={driver.id} className="transition hover:bg-[#f8fbfd]">
                    <td className="px-5 py-4">
                      <p className="font-bold text-[#1a1a1a]">{driver.name || "بدون اسم"}</p>
                      <p dir="ltr" className="mt-1 text-xs text-[#606060]">{driver.phoneNumber || "—"}</p>
                    </td>
                    <td className="px-5 py-4 font-medium text-[#334454]">{driver.fleet.name}</td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-[#334454]">{driver.fleetOwner.name || "بدون اسم"}</p>
                      <p dir="ltr" className="mt-1 text-xs text-[#606060]">{driver.fleetOwner.phoneNumber || "—"}</p>
                    </td>
                    <td className="px-5 py-4">
                      {driver.assignedBus ? <span className="font-medium text-[#334454]" dir="ltr">{driver.assignedBus.registrationNumber}</span> : <span className="text-[#8895a3]">غير معيّن</span>}
                    </td>
                    <td className="px-5 py-4"><span className={driver.status === "ACTIVE" ? "status-pill" : "status-pill status-pill-muted"}>{MEMBER_STATUS_AR[driver.status as keyof typeof MEMBER_STATUS_AR] ?? driver.status}</span></td>
                    <td className="px-5 py-4"><Button asChild size="sm" variant="secondary"><Link href={`/drivers/${driver.id}?fleetId=${driver.fleet.id}`}>إدارة</Link></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleDrivers.length === 0 ? <p className="p-6 text-center text-sm text-[#606060]">لا يوجد سواقون مطابقون للبحث.</p> : null}
          {nextCursor ? <div className="border-t border-[#e4ecf2] p-4 text-center"><Button type="button" variant="secondary" onClick={() => void load(nextCursor)} disabled={loadingMore}>{loadingMore ? "جاري التحميل…" : "تحميل المزيد"}</Button></div> : null}
        </div>
      )}
    </div>
  );
}
