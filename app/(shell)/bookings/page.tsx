"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Filter, Plus, RotateCcw, Ticket } from "lucide-react";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BOOKING_STATUS_AR,
  fetchAdminBookingsPage,
  PAYMENT_METHOD_AR,
  PAYMENT_STATUS_AR,
  type AdminBookingFilterParams,
  type AdminBookingListItem,
} from "@/lib/actions/bookings";
import { apiGet } from "@/lib/actions/http";

type FleetOption = { id: string; name: string };

export default function BookingsPage() {
  const [items, setItems] = useState<AdminBookingListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fleets, setFleets] = useState<FleetOption[]>([]);
  const [, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState("");
  const [fleetId, setFleetId] = useState("");
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [hasReports, setHasReports] = useState(false);
  const [dateType, setDateType] = useState<"created" | "departure">("departure");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    apiGet<{ items: FleetOption[] }>("/api/fleets?limit=100").then((result) => {
      if (result.ok) setFleets(result.data.items);
    });
  }, []);

  const buildFilterParams = useCallback((): AdminBookingFilterParams => {
    const params: AdminBookingFilterParams = { limit: 20 };
    if (fleetId) params.fleetId = fleetId;
    if (searchTerm.trim()) {
      if (/^\+?[0-9]+$/.test(searchTerm.trim())) params.passengerPhone = searchTerm.trim();
      else params.passengerName = searchTerm.trim();
    }
    if (status !== "all") params.status = status;
    if (paymentStatus !== "all") params.paymentStatus = paymentStatus;
    if (paymentMethod !== "all") params.paymentMethod = paymentMethod;
    if (hasReports) params.hasReports = true;
    if (dateType === "departure") {
      if (fromDate) params.departureFrom = new Date(fromDate).toISOString();
      if (toDate) { const date = new Date(toDate); date.setHours(23, 59, 59, 999); params.departureTo = date.toISOString(); }
    } else {
      if (fromDate) params.createdFrom = new Date(fromDate).toISOString();
      if (toDate) { const date = new Date(toDate); date.setHours(23, 59, 59, 999); params.createdTo = date.toISOString(); }
    }
    return params;
  }, [fleetId, searchTerm, status, paymentStatus, paymentMethod, hasReports, dateType, fromDate, toDate]);

  useEffect(() => {
    let cancelled = false;
    fetchAdminBookingsPage(buildFilterParams(), null).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setItems(result.data.items);
        setNextCursor(result.data.nextCursor);
        setError(null);
      } else setError(result.message);
    });
    return () => { cancelled = true; };
  }, [buildFilterParams]);

  function resetFilters() {
    startTransition(() => {
      setSearchTerm("");
      setFleetId("");
      setStatus("all");
      setPaymentStatus("all");
      setPaymentMethod("all");
      setHasReports(false);
      setFromDate("");
      setToDate("");
    });
  }

  const hasActiveFilters = Boolean(searchTerm || fleetId || hasReports || fromDate || toDate) || status !== "all" || paymentStatus !== "all" || paymentMethod !== "all";
  const columns: CommunityColumnDef<AdminBookingListItem>[] = [
    { field: "passengerName", headerName: "الراكب", filter: "agTextColumnFilter" },
    { field: "passengerPhone", headerName: "الموبايل", filter: "agTextColumnFilter" },
    { field: "fleetName", headerName: "الأسطول", filter: "agTextColumnFilter" },
    { field: "originName", headerName: "البداية" },
    { field: "destinationName", headerName: "الوجهة" },
    { field: "seats", headerName: "المقاعد", filter: "agNumberColumnFilter" },
    { field: "status", headerName: "حالة الحجز", valueFormatter: (params) => BOOKING_STATUS_AR[params.value as keyof typeof BOOKING_STATUS_AR] ?? params.value },
    { field: "paymentStatus", headerName: "حالة الدفع", valueFormatter: (params) => PAYMENT_STATUS_AR[params.value as keyof typeof PAYMENT_STATUS_AR] ?? params.value },
    { field: "paymentMethod", headerName: "طريقة الدفع", valueFormatter: (params) => PAYMENT_METHOD_AR[params.value as keyof typeof PAYMENT_METHOD_AR] ?? params.value },
    { field: "totalAmount", headerName: "الإجمالي", filter: "agNumberColumnFilter" },
    { field: "hasReports", headerName: "بلاغات", valueFormatter: (params) => params.value ? "نعم" : "لا" },
    { field: "createdAt", headerName: "تاريخ الحجز", filter: "agDateColumnFilter", valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString("ar-EG") : "—" },
    {
      headerName: "إجراء",
      filter: false,
      sortable: false,
      exportable: false,
      cellRenderer: (params: { data?: AdminBookingListItem }) => params.data ? <Button asChild size="sm" variant="secondary"><Link href={`/bookings/${params.data.id}`}>عرض التفاصيل</Link></Button> : null,
    },
  ];

  return (
    <div className="dashboard-page space-y-6">
      <div className="page-heading">
        <div>
          <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-[#daeaf5] text-[#204c6b]"><Ticket className="size-5" /></span><h1 className="page-title">مراجعة وإدارة الحجوزات</h1></div>
          <p className="page-description">رؤية مركزية شاملة لجميع الحجوزات عبر كل الأساطيل، فحص العمليات، وتدقيق المدفوعات والاسترداد.</p>
        </div>
        <Button asChild className="gap-2"><Link href="/bookings/new"><Plus className="size-4" /> حجز جديد</Link></Button>
      </div>

      <div className="rounded-2xl border border-[#daeaf5] bg-white p-4 shadow-sm space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input aria-label="بحث باسم الراكب أو رقم الموبايل" placeholder="اسم الراكب أو رقم الموبايل…" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="bg-white" />
          <select aria-label="تصفية حسب الأسطول" value={fleetId} onChange={(event) => setFleetId(event.target.value)} className="select-field w-full"><option value="">كل الأساطيل ({fleets.length})</option>{fleets.map((fleet) => <option key={fleet.id} value={fleet.id}>{fleet.name}</option>)}</select>
          <select aria-label="حالة الحجز" value={status} onChange={(event) => setStatus(event.target.value)} className="select-field w-full"><option value="all">كل حالات الحجز</option><option value="CONFIRMED">مؤكد</option><option value="CANCELLED">ملغي</option><option value="COMPLETED">مكتمل</option></select>
          <select aria-label="حالة الدفع" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} className="select-field w-full"><option value="all">كل حالات الدفع</option><option value="PENDING">في انتظار الدفع</option><option value="PAID">تم الدفع</option><option value="REFUNDED">مسترد بالكامل</option><option value="FAILED">فشل الدفع</option></select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e4ecf2] pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <select aria-label="طريقة الدفع" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="select-field text-xs sm:text-sm"><option value="all">كل طرق الدفع</option><option value="VODAFONE_CASH">فودافون كاش</option><option value="INSTAPAY">إنستاباي</option><option value="WALLET">محفظة إلكترونية</option><option value="CASH">نقدي</option><option value="CARD">بطاقة بنكية</option></select>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#d8e4ec] bg-[#f8fbfd] px-3 py-1.5 text-xs sm:text-sm"><input type="checkbox" checked={hasReports} onChange={(event) => setHasReports(event.target.checked)} className="size-4" /><span className="flex items-center gap-1 font-semibold text-red-700"><AlertTriangle className="size-3.5" /> حجوزات بها بلاغات</span></label>
            <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="flex items-center gap-1 text-xs font-semibold text-[#2f719e] hover:underline sm:text-sm"><Filter className="size-3.5" /> {showAdvanced ? "إخفاء تصفية التاريخ" : "تصفية بالتواريخ"}</button>
          </div>
          {hasActiveFilters ? <button type="button" onClick={resetFilters} className="flex items-center gap-1 text-xs font-medium text-[#606060] hover:text-red-700 sm:text-sm"><RotateCcw className="size-3.5" /> إعادة ضبط الفلاتر</button> : null}
        </div>
        {showAdvanced ? <div className="grid gap-3 border-t border-[#e4ecf2] pt-3 sm:grid-cols-3"><select aria-label="نوع التاريخ" value={dateType} onChange={(event) => setDateType(event.target.value as "created" | "departure")} className="select-field w-full"><option value="departure">موعد إقلاع الرحلة</option><option value="created">تاريخ إنشاء الحجز</option></select><Input type="date" aria-label="من تاريخ" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="bg-white" /><Input type="date" aria-label="إلى تاريخ" value={toDate} onChange={(event) => setToDate(event.target.value)} className="bg-white" /></div> : null}
      </div>

      {error ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      <AgGridTable<AdminBookingListItem>
        key={`${items[0]?.id ?? "empty"}-${items.length}`}
        gridId="bookings"
        rows={items}
        columnDefs={columns}
        showSearch={false}
        nextCursor={nextCursor}
        loadMore={async (cursor) => {
          const result = await fetchAdminBookingsPage(buildFilterParams(), cursor);
          if (!result.ok) throw new Error(result.message);
          return result.data;
        }}
        loading={loading}
        emptyMessage="لا توجد حجوزات مطابقة لمعايير البحث الحالية."
        getRowId={(booking) => booking.id}
      />
    </div>
  );
}
