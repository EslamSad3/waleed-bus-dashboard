"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { fetchFleetsPage, fetchUserOptions, type Fleet } from "@/lib/actions/fleets";
import { useFilterStore } from "@/stores/filters";

type FleetRow = Fleet & { ownerName: string };

async function withOwnerNames(page: { items: Fleet[]; nextCursor: string | null }): Promise<{ items: FleetRow[]; nextCursor: string | null }> {
  const users = await fetchUserOptions();
  const ownerNames = users.ok
    ? new Map(users.data.items.map((user) => [user.id, user.name || user.email || user.phone || user.phoneNumber || "غير معروف"]))
    : new Map<string, string>();
  return {
    nextCursor: page.nextCursor,
    items: page.items.map((fleet) => ({ ...fleet, ownerName: ownerNames.get(fleet.ownerId) ?? "غير معروف" })),
  };
}

export default function FleetsPage() {
  const [first, setFirst] = useState<{ items: FleetRow[]; nextCursor: string | null } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const { listFilters, setListFilter } = useFilterStore();
  const f = listFilters["fleets"] ?? {};

  useEffect(() => {
    fetchFleetsPage(null).then(async (r) => {
      if (r.ok) setFirst(await withOwnerNames(r.data));
      else setFailed(r.message);
    });
  }, []);

  const q = (f.q ?? "").trim();
  const status = f.status ?? "all";
  const predicate = (fleet: FleetRow) =>
    (!q || fleet.name.includes(q) || fleet.ownerName.includes(q)) &&
    (status === "all" || (status === "active" ? fleet.isActive : !fleet.isActive));

  const columns: CommunityColumnDef<FleetRow>[] = [
    { field: "name", headerName: "الأسطول", filter: "agTextColumnFilter" },
    { field: "ownerName", headerName: "مالك الأسطول", filter: "agTextColumnFilter" },
    { field: "isActive", headerName: "الحالة", filter: "agTextColumnFilter", cellDataType: "text", valueFormatter: (params) => params.value ? "نشط" : "موقوف" },
    { field: "createdAt", headerName: "تاريخ الإنشاء", filter: "agDateColumnFilter", valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString("ar-EG") : "—" },
    { field: "updatedAt", headerName: "آخر تحديث", filter: "agDateColumnFilter", valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString("ar-EG") : "—" },
  ];

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
        <CursorList<FleetRow>
          initialItems={first.items}
          initialCursor={first.nextCursor}
          loadMore={(cursor) =>
            fetchFleetsPage(cursor).then(async (r) => {
              if (!r.ok) throw new Error(r.message);
              return withOwnerNames(r.data);
            })
          }
          keyOf={(fleet) => fleet.id}
          filter={predicate}
          columnDefs={columns}
          filterBar={
            <div className="contents">
              <Input
                aria-label="دور باسم الأسطول أو المالك"
                placeholder="دور باسم الأسطول أو المالك"
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
              <span>
                <span className="block font-semibold text-[#1a1a1a]">{fleet.name}</span>
                <span className="mt-1 block text-xs text-[#606060]">المالك: {fleet.ownerName}</span>
              </span>
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
