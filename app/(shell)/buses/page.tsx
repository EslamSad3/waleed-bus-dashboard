"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import { fetchBusesPage, type Bus } from "@/lib/actions/buses";
import { useFilterStore } from "@/stores/filters";

export default function BusesPage() {
  const { fleetId, listFilters, setListFilter } = useFilterStore();
  const [first, setFirst] = useState<{ key: string; items: Bus[]; nextCursor: string | null } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  const f = listFilters["buses"] ?? {};

  useEffect(() => {
    if (!fleetId) return;
    fetchBusesPage(fleetId, null).then((r) => {
      if (r.ok) setFirst({ key: fleetId, items: r.data.items, nextCursor: r.data.nextCursor });
      else setFailed({ key: fleetId, message: r.message });
    });
  }, [fleetId]);

  const loading = !first || first.key !== fleetId;
  const showFailed = failed && failed.key === fleetId ? failed.message : null;

  const q = (f.q ?? "").trim();
  const status = f.status ?? "all";
  const predicate = (b: Bus) =>
    (!q || b.registrationNumber.includes(q) || (b.plateNumber ?? "").includes(q)) &&
    (status === "all" || (status === "active" ? b.isActive : !b.isActive));

  if (!fleetId) {
    return (
      <div className="dashboard-page">
        <h1 className="page-title">الأتوبيسات</h1>
        <p className="empty-state">اختار الأسطول الأول لعرض الأتوبيسات</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">الأتوبيسات</h1>
          <p className="page-description">إدارة بيانات الأتوبيسات وحالتها وتعيين السواقين.</p>
        </div>
        <Button asChild>
          <Link href="/buses/new">أتوبيس جديد</Link>
        </Button>
      </div>

      {showFailed ? (
        <p role="alert" className="text-sm text-red-600">{showFailed}</p>
      ) : loading || !first ? (
        <p className="text-sm text-[#606060]">جاري التحميل…</p>
      ) : (
        <CursorList<Bus>
          key={fleetId}
          initialItems={first.items}
          initialCursor={first.nextCursor}
          loadMore={(cursor) =>
            fetchBusesPage(fleetId, cursor).then((r) => {
              if (!r.ok) throw new Error(r.message);
              return { items: r.data.items, nextCursor: r.data.nextCursor };
            })
          }
          keyOf={(b) => b.id}
          filter={predicate}
          filterBar={
            <div className="contents">
              <Input
                aria-label="بحث برقم التسجيل أو اللوحة"
                placeholder="بحث برقم التسجيل أو اللوحة"
                value={f.q ?? ""}
                onChange={(e) => setListFilter("buses", { q: e.target.value })}
                className="max-w-xs bg-white"
              />
              <select
                aria-label="الحالة"
                value={status}
                onChange={(e) => setListFilter("buses", { status: e.target.value })}
                className="select-field"
              >
                <option value="all">الكل</option>
                <option value="active">نشط</option>
                <option value="inactive">موقوف</option>
              </select>
            </div>
          }
          emptyMessage="لا توجد أتوبيسات في الأسطول ده — ابدأ بإضافة جديد"
          renderItem={(b) => (
            <Link
              href={`/buses/${b.id}`}
              className="list-card"
            >
              <span className="font-semibold text-[#1a1a1a]">
                <span dir="ltr">{b.registrationNumber}</span>
                {b.plateNumber ? <span className="text-sm text-[#606060]"> · <span dir="ltr">{b.plateNumber}</span></span> : null}
              </span>
              <span className="flex items-center gap-3 text-sm text-[#606060]">
                <span>السعة <span dir="ltr">{b.capacity}</span></span>
                <span className={b.isActive ? "status-pill" : "status-pill status-pill-muted"}>
                  {b.isActive ? "نشط" : "موقوف"}
                </span>
              </span>
            </Link>
          )}
        />
      )}
    </div>
  );
}
