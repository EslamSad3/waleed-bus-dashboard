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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="title-grad text-2xl font-extrabold">الأساطيل</h1>
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
            <div className="flex flex-wrap gap-2">
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
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
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
              className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow transition-colors hover:bg-[#daeaf5]"
            >
              <span className="font-semibold text-[#1a1a1a]">{fleet.name}</span>
              <span className="flex items-center gap-3 text-sm text-[#606060]">
                <span
                  className={
                    fleet.isActive
                      ? "rounded-full bg-green-100 px-3 py-0.5 text-green-800"
                      : "rounded-full bg-slate-200 px-3 py-0.5 text-slate-700"
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
