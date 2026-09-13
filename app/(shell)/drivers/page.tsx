"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import { fetchDriversPage } from "@/lib/actions/members";
import type { DriverRow } from "@/lib/actions/members";
import { useFilterStore } from "@/stores/filters";

export default function DriversPage() {
  const { fleetId, listFilters, setListFilter } = useFilterStore();
  const [first, setFirst] = useState<{ key: string; items: DriverRow[]; nextCursor: string | null } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  const f = listFilters["drivers"] ?? {};

  function reload() {
    if (!fleetId) return;
    fetchDriversPage(fleetId, null).then((r) => {
      if (r.ok) setFirst({ key: fleetId, items: r.data.items, nextCursor: r.data.nextCursor });
      else setFailed({ key: fleetId, message: r.message });
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fleetId]);

  const loading = !first || first.key !== fleetId;
  const showFailed = failed && failed.key === fleetId ? failed.message : null;

  const q = (f.q ?? "").trim();
  const status = f.status ?? "all";
  const predicate = (d: DriverRow) =>
    (!q || (d.name ?? "").includes(q) || (d.phoneNumber ?? "").includes(q)) &&
    (status === "all" || d.status === status);

  if (!fleetId) {
    return (
      <div className="dashboard-page">
        <h1 className="page-title">السواقين</h1>
        <p className="empty-state">اختار الأسطول الأول لعرض السواقين</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div><h1 className="page-title">السواقين</h1><p className="page-description">إدارة حسابات السواقين وعضوية الأسطول وسجل التعيينات.</p></div>
        <Link href="/drivers/new" className="inline-flex h-11 items-center justify-center rounded-xl bg-[#2f719e] px-5 text-sm font-bold text-white shadow-lg shadow-[#2f719e]/15 transition hover:-translate-y-0.5 hover:bg-[#275e83]">إضافة سواق</Link>
      </div>

      {showFailed ? (
        <p role="alert" className="text-sm text-red-600">{showFailed}</p>
      ) : loading || !first ? (
        <p className="text-sm text-[#606060]">جاري التحميل…</p>
      ) : (
        <CursorList<DriverRow>
          key={fleetId}
          initialItems={first.items}
          initialCursor={first.nextCursor}
          loadMore={(cursor) =>
            fetchDriversPage(fleetId, cursor).then((r) => {
              if (!r.ok) throw new Error(r.message);
              return { items: r.data.items, nextCursor: r.data.nextCursor };
            })
          }
          keyOf={(d) => d.id}
          filter={predicate}
          filterBar={
            <div className="contents">
              <Input
                aria-label="بحث بالاسم أو الموبايل"
                placeholder="بحث بالاسم أو الموبايل"
                value={f.q ?? ""}
                onChange={(e) => setListFilter("drivers", { q: e.target.value })}
                className="max-w-xs bg-white"
              />
              <select
                aria-label="الحالة"
                value={status}
                onChange={(e) => setListFilter("drivers", { status: e.target.value })}
                className="select-field"
              >
                <option value="all">كل الحالات</option>
                <option value="ACTIVE">نشط</option>
                <option value="SUSPENDED">موقوف</option>
                <option value="REVOKED">ملغي الصلاحية</option>
              </select>
            </div>
          }
          emptyMessage="لا يوجد سواقين في الأسطول ده"
          renderItem={(d) => (
            <Link
              href={`/drivers/${d.id}`}
              className="list-card"
            >
              <span className="font-semibold text-[#1a1a1a]">
                {d.name ?? <span dir="ltr">{(d.userId ?? d.id).slice(0, 8)}…</span>}
                {d.phoneNumber ? <span className="text-sm text-[#606060]"> · <span dir="ltr">{d.phoneNumber}</span></span> : null}
              </span>
              <span className={d.status === "ACTIVE" ? "status-pill" : "status-pill status-pill-muted"}>{d.status === "ACTIVE" ? "نشط" : d.status}</span>
            </Link>
          )}
        />
      )}
    </div>
  );
}
