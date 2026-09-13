"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import { fetchFleetsPage, type Fleet } from "@/lib/actions/fleets";
import { useFilterStore } from "@/stores/filters";

export default function FleetsPage() {
  const [first, setFirst] = useState<{ items: Fleet[]; nextCursor: string | null } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const { listFilters, setListFilter } = useFilterStore();
  const f = listFilters["fleets"] ?? {};

  useEffect(() => {
    fetchFleetsPage(null).then((r) => {
      if (r.ok) setFirst({ items: r.data.items, nextCursor: r.data.nextCursor });
      else setFailed(r.message);
    });
  }, []);

  const q = (f.q ?? "").trim();
  const status = f.status ?? "all";
  const predicate = (fleet: Fleet) =>
    (!q || fleet.name.includes(q)) &&
    (status === "all" || (status === "active" ? fleet.isActive : !fleet.isActive));

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">الأساطيل</h1>
          <p className="page-description">كل الأساطيل المسجلة وحالة تشغيل كل أسطول.</p>
        </div>
        <Button asChild>
          <Link href="/fleets/new">أسطول جديد</Link>
        </Button>
      </div>

      {failed ? (
        <p role="alert" className="text-sm text-red-600">{failed}</p>
      ) : !first ? (
        <p className="text-sm text-[#606060]">جاري التحميل…</p>
      ) : (
        <CursorList<Fleet>
          initialItems={first.items}
          initialCursor={first.nextCursor}
          loadMore={(cursor) =>
            fetchFleetsPage(cursor).then((r) => {
              if (!r.ok) throw new Error(r.message);
              return { items: r.data.items, nextCursor: r.data.nextCursor };
            })
          }
          keyOf={(fleet) => fleet.id}
          filter={predicate}
          filterBar={
            <div className="contents">
              <Input
                aria-label="دور باسم الأسطول"
                placeholder="دور باسم الأسطول"
                value={f.q ?? ""}
                onChange={(e) => setListFilter("fleets", { q: e.target.value })}
                className="max-w-xs bg-white"
              />
              <select
                aria-label="الحالة"
                value={status}
                onChange={(e) => setListFilter("fleets", { status: e.target.value })}
                className="select-field"
              >
                <option value="all">الكل</option>
                <option value="active">نشط</option>
                <option value="inactive">موقوف</option>
              </select>
            </div>
          }
          emptyMessage="لا توجد أساطيل بعد — ابدأ بإضافة جديد"
          renderItem={(fleet) => (
            <Link
              href={`/fleets/${fleet.id}`}
              className="list-card"
            >
              <span className="font-semibold text-[#1a1a1a]">{fleet.name}</span>
              <span className="flex flex-wrap items-center gap-3 text-sm text-[#5e6b78]">
                <span
                  className={
                    fleet.isActive
                      ? "status-pill"
                      : "status-pill status-pill-muted"
                  }
                >
                  {fleet.isActive ? "نشط" : "موقوف"}
                </span>
                <time dateTime={fleet.createdAt}>
                  {new Date(fleet.createdAt).toLocaleDateString("en-EG")}
                </time>
              </span>
            </Link>
          )}
        />
      )}
    </div>
  );
}
