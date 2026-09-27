"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { fetchTripLines, type TripLine } from "@/lib/actions/trip-lines";
import { CreateTripLineDialog } from "@/components/trip-lines/create-trip-line-dialog";
import { qk, useApiQuery } from "@/lib/queries";

export default function TripLinesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: lines, isLoading, error } = useApiQuery<TripLine[]>(qk.tripLines, fetchTripLines);

  const columns: CommunityColumnDef<TripLine>[] = [
    { field: "name", headerName: "اسم الخط", filter: "agTextColumnFilter" },
    { field: "code", headerName: "الكود", filter: "agTextColumnFilter" },
    { field: "origin", headerName: "البداية" },
    { field: "destination", headerName: "الوجهة" },
    { colId: "stationCount", headerName: "نقاط التوقف", valueGetter: (params) => params.data?.stations.length, filter: "agNumberColumnFilter" },
    { field: "isActive", headerName: "الحالة", valueFormatter: (params) => params.value ? "نشط" : "موقوف" },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">خطوط الرحلات</h1>
          <p className="page-description">مسارات موحّدة لكل النظام، مبنية من نقاط التوقف المسجلة.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> خط رحلة جديد</Button>
      </div>
      {error ? <p role="alert" className="text-sm text-red-600">{error.message}</p> : null}
      {isLoading ? <p className="text-sm text-slate-500">جاري التحميل…</p> : (
        <CursorList<TripLine>
          gridId="trip-lines"
          initialItems={lines ?? []}
          initialCursor={null}
          loadMore={async () => ({ items: [], nextCursor: null })}
          keyOf={(line) => line.id}
          columnDefs={columns}
          emptyMessage="لا توجد خطوط رحلة بعد — أضف نقاط التوقف أولًا."
          renderItem={(line) => (
            <Button asChild size="sm" variant="secondary"><Link href={`/trip-lines/${line.id}`}>إدارة</Link></Button>
          )}
        />
      )}
      <CreateTripLineDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
