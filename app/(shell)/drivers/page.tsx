"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { fetchSystemDriversPage, MEMBER_STATUS_AR, type SystemDriverRow } from "@/lib/actions/members";

export default function DriversPage() {
  const [drivers, setDrivers] = useState<SystemDriverRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemDriversPage(null).then((result) => {
      if (!result.ok) {
        setError(result.message);
      } else {
        setDrivers(result.data.items);
        setNextCursor(result.data.nextCursor);
      }
      setLoading(false);
    });
  }, []);

  const columns: CommunityColumnDef<SystemDriverRow>[] = [
    { field: "name", headerName: "السواق", filter: "agTextColumnFilter", valueFormatter: (params) => params.value || "بدون اسم" },
    { field: "phoneNumber", headerName: "الموبايل", filter: "agTextColumnFilter" },
    { field: "fleet.name", headerName: "الأسطول", valueGetter: (params) => params.data?.fleet.name },
    { field: "fleetOwner.name", headerName: "مالك الأسطول", valueGetter: (params) => params.data?.fleetOwner.name || "بدون اسم" },
    { field: "assignedBus.registrationNumber", headerName: "الأتوبيس المعيّن", valueGetter: (params) => params.data?.assignedBus?.registrationNumber || "غير معيّن" },
    {
      field: "status",
      headerName: "الحالة",
      filter: "agTextColumnFilter",
      valueFormatter: (params) => MEMBER_STATUS_AR[params.value as keyof typeof MEMBER_STATUS_AR] ?? params.value,
    },
    {
      headerName: "إدارة",
      filter: false,
      sortable: false,
      exportable: false,
      cellRenderer: (params: { data?: SystemDriverRow }) => params.data ? (
        <Button asChild size="sm" variant="secondary">
          <Link href={`/drivers/${params.data.id}?fleetId=${params.data.fleet.id}`}>إدارة</Link>
        </Button>
      ) : null,
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">السواقين</h1>
          <p className="page-description">كل حسابات السواقين في النظام، مع الأسطول ومالك الأسطول والأتوبيس المعيّن حاليًا.</p>
        </div>
        <Button asChild><Link href="/drivers/new">إضافة سواق</Link></Button>
      </div>

      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <AgGridTable<SystemDriverRow>
        key={`${drivers[0]?.id ?? "loading"}-${drivers.length}`}
        gridId="drivers"
        rows={drivers}
        columnDefs={columns}
        nextCursor={nextCursor}
        loadMore={async (cursor) => {
          const result = await fetchSystemDriversPage(cursor);
          if (!result.ok) throw new Error(result.message);
          return result.data;
        }}
        loading={loading}
        emptyMessage="لا يوجد سواقون مطابقون للبحث."
        getRowId={(driver) => driver.id}
      />
    </div>
  );
}
