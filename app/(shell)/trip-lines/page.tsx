"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { fetchTripLines, type TripLine } from "@/lib/actions/trip-lines";

export default function TripLinesPage() {
  const [lines, setLines] = useState<TripLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTripLines().then((result) => result.ok ? setLines(result.data) : setError(result.message));
  }, []);

  const columns: CommunityColumnDef<TripLine>[] = [
    { field: "name", headerName: "اسم الخط", filter: "agTextColumnFilter" },
    { field: "code", headerName: "الكود", filter: "agTextColumnFilter" },
    { field: "origin", headerName: "البداية" },
    { field: "destination", headerName: "الوجهة" },
    { colId: "stationCount", headerName: "نقاط التوقف", valueGetter: (params) => params.data?.stations.length, filter: "agNumberColumnFilter" },
    { field: "isActive", headerName: "الحالة", valueFormatter: (params) => params.value ? "نشط" : "موقوف" },
    {
      headerName: "إجراء",
      filter: false,
      sortable: false,
      exportable: false,
      cellRenderer: (params: { data?: TripLine }) => params.data ? <Button asChild size="sm" variant="secondary"><Link href={`/trip-lines/${params.data.id}`}>إدارة</Link></Button> : null,
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">خطوط الرحلات</h1>
          <p className="page-description">مسارات موحّدة لكل النظام، مبنية من نقاط التوقف المسجلة.</p>
        </div>
        <Button asChild><Link href="/trip-lines/new"><Plus className="size-4" /> خط رحلة جديد</Link></Button>
      </div>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      {!lines ? <p className="text-sm text-slate-500">جاري التحميل…</p> : (
        <AgGridTable<TripLine>
          gridId="trip-lines"
          rows={lines}
          columnDefs={columns}
          emptyMessage="لا توجد خطوط رحلة بعد — أضف نقاط التوقف أولًا."
          getRowId={(line) => line.id}
        />
      )}
    </div>
  );
}
