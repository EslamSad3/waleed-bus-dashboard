"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import { fetchTripsPage, TRIP_STATUS_AR, type Trip } from "@/lib/actions/trips";
import { useFilterStore } from "@/stores/filters";

export default function TripsPage() {
  const { fleetId, listFilters, setListFilter } = useFilterStore();
  const [first, setFirst] = useState<{ key: string; items: Trip[]; nextCursor: string | null } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  const f = listFilters["trips"] ?? {};

  useEffect(() => {
    if (!fleetId) return;
    fetchTripsPage(fleetId, null).then((r) => {
      if (r.ok) setFirst({ key: fleetId, items: r.data.items, nextCursor: r.data.nextCursor });
      else setFailed({ key: fleetId, message: r.message });
    });
  }, [fleetId]);

  const loading = !first || first.key !== fleetId;
  const showFailed = failed && failed.key === fleetId ? failed.message : null;

  const q = (f.q ?? "").trim();
  const status = f.status ?? "all";
  const from = f.from ?? "";
  const to = f.to ?? "";
  const predicate = (t: Trip) =>
    (!q || t.origin.includes(q) || t.destination.includes(q)) &&
    (status === "all" || t.status === status) &&
    (!from || t.departAt.slice(0, 10) >= from) &&
    (!to || t.departAt.slice(0, 10) <= to);

  if (!fleetId) {
    return (
      <div className="dashboard-page">
        <h1 className="page-title">الرحلات</h1>
        <p className="empty-state">اختار الأسطول الأول لعرض الرحلات</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">الرحلات</h1>
          <p className="page-description">جدولة الرحلات ومتابعة الخط والميعاد وحالة التشغيل.</p>
        </div>
        <Button asChild>
          <Link href="/trips/new">رحلة جديدة</Link>
        </Button>
      </div>

      {showFailed ? (
        <p role="alert" className="text-sm text-red-600">{showFailed}</p>
      ) : loading || !first ? (
        <p className="text-sm text-[#606060]">جاري التحميل…</p>
      ) : (
        <CursorList<Trip>
          key={fleetId}
          initialItems={first.items}
          initialCursor={first.nextCursor}
          loadMore={(cursor) =>
            fetchTripsPage(fleetId, cursor).then((r) => {
              if (!r.ok) throw new Error(r.message);
              return { items: r.data.items, nextCursor: r.data.nextCursor };
            })
          }
          keyOf={(t) => t.id}
          filter={predicate}
          filterBar={
            <div className="contents">
              <Input
                aria-label="بحث بالمنشأ أو الوجهة"
                placeholder="من / إلى"
                value={f.q ?? ""}
                onChange={(e) => setListFilter("trips", { q: e.target.value })}
                className="max-w-52 bg-white"
              />
              <select
                aria-label="الحالة"
                value={status}
                onChange={(e) => setListFilter("trips", { status: e.target.value })}
                className="select-field"
              >
                <option value="all">كل الحالات</option>
                <option value="SCHEDULED">مجدولة</option>
                <option value="DEPARTED">شغالة</option>
                <option value="COMPLETED">خلصت</option>
                <option value="CANCELLED">ملغية</option>
              </select>
              <Input
                aria-label="من تاريخ"
                type="date"
                value={from}
                onChange={(e) => setListFilter("trips", { from: e.target.value })}
                className="max-w-44 bg-white"
              />
              <Input
                aria-label="إلى تاريخ"
                type="date"
                value={to}
                onChange={(e) => setListFilter("trips", { to: e.target.value })}
                className="max-w-44 bg-white"
              />
            </div>
          }
          emptyMessage="لا توجد رحلات في الأسطول ده — ابدأ بإضافة جديد"
          renderItem={(t) => (
            <Link
              href={`/trips/${t.id}`}
              className="list-card"
            >
              <span className="font-semibold text-[#1a1a1a]">{t.origin} ← {t.destination}</span>
              <span className="flex flex-wrap items-center gap-2 text-sm text-[#5e6b78]">
                <span className={t.status === "CANCELLED" ? "status-pill status-pill-muted" : "status-pill"}>
                  {TRIP_STATUS_AR[t.status]}
                </span>
                <time dateTime={t.departAt}>{new Date(t.departAt).toLocaleString("en-EG")}</time>
              </span>
            </Link>
          )}
        />
      )}
    </div>
  );
}
