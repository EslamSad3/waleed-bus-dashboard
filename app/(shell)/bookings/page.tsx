"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchAdminBookingsPage,
  BOOKING_STATUS_AR,
  PAYMENT_STATUS_AR,
  PAYMENT_METHOD_AR,
  type AdminBookingListItem,
  type AdminBookingFilterParams,
} from "@/lib/actions/bookings";
import { apiGet } from "@/lib/actions/http";
import {
  Ticket,
  Search,
  Filter,
  Calendar,
  User,
  Phone,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  Building2,
  Plus,
} from "lucide-react";

type FleetOption = { id: string; name: string };

export default function BookingsPage() {
  const [items, setItems] = useState<AdminBookingListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fleets, setFleets] = useState<FleetOption[]>([]);
  const [, startTransition] = useTransition();

  // Filter states
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

  // Load fleets for the dropdown filter
  useEffect(() => {
    apiGet<{ items: FleetOption[] }>("/api/fleets?limit=100").then((res) => {
      if (res.ok) setFleets(res.data.items);
    });
  }, []);

  const buildFilterParams = useCallback((): AdminBookingFilterParams => {
    const params: AdminBookingFilterParams = {
      limit: 20,
    };
    if (fleetId) params.fleetId = fleetId;
    if (searchTerm.trim()) {
      // If looks like Egyptian phone number or starts with 01
      if (/^\+?[0-9]+$/.test(searchTerm.trim())) {
        params.passengerPhone = searchTerm.trim();
      } else {
        params.passengerName = searchTerm.trim();
      }
    }
    if (status !== "all") params.status = status;
    if (paymentStatus !== "all") params.paymentStatus = paymentStatus;
    if (paymentMethod !== "all") params.paymentMethod = paymentMethod;
    if (hasReports) params.hasReports = true;

    if (dateType === "departure") {
      if (fromDate) params.departureFrom = new Date(fromDate).toISOString();
      if (toDate) {
        const d = new Date(toDate);
        d.setHours(23, 59, 59, 999);
        params.departureTo = d.toISOString();
      }
    } else {
      if (fromDate) params.createdFrom = new Date(fromDate).toISOString();
      if (toDate) {
        const d = new Date(toDate);
        d.setHours(23, 59, 59, 999);
        params.createdTo = d.toISOString();
      }
    }

    return params;
  }, [fleetId, searchTerm, status, paymentStatus, paymentMethod, hasReports, dateType, fromDate, toDate]);

  useEffect(() => {
    let cancelled = false;
    const params = buildFilterParams();
    fetchAdminBookingsPage(params, null).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok) {
        setItems(res.data.items);
        setNextCursor(res.data.nextCursor);
        setError(null);
      } else {
        setError(res.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [buildFilterParams]);

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const params = buildFilterParams();
    const res = await fetchAdminBookingsPage(params, nextCursor);
    setLoadingMore(false);
    if (res.ok) {
      setItems((prev) => [...prev, ...res.data.items]);
      setNextCursor(res.data.nextCursor);
    } else {
      setError(res.message);
    }
  }

  function handleResetFilters() {
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

  const hasActiveFilters =
    Boolean(searchTerm) ||
    Boolean(fleetId) ||
    status !== "all" ||
    paymentStatus !== "all" ||
    paymentMethod !== "all" ||
    hasReports ||
    Boolean(fromDate) ||
    Boolean(toDate);

  return (
    <div className="dashboard-page space-y-6">
      {/* Top Header */}
      <div className="page-heading">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-[#daeaf5] text-[#204c6b]">
              <Ticket className="size-5" />
            </span>
            <h1 className="page-title">مراجعة وإدارة الحجوزات</h1>
          </div>
          <p className="page-description">
            رؤية مركزية شاملة لجميع الحجوزات عبر كل الأساطيل، فحص العمليات، وتدقيق المدفوعات والاسترداد.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/bookings/new">
            <Plus className="size-4" />
            <span>حجز جديد</span>
          </Link>
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-[#daeaf5] bg-white p-4 shadow-sm space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search by Passenger Name or Phone */}
          <div className="relative">
            <Search className="absolute start-3 top-3 size-4 text-[#919191]" />
            <Input
              aria-label="بحث باسم الراكب أو رقم الموبايل"
              placeholder="اسم الراكب أو رقم الموبايل…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ps-9 bg-white"
            />
          </div>

          {/* Fleet Filter */}
          <div>
            <select
              aria-label="تصفية حسب الأسطول"
              value={fleetId}
              onChange={(e) => setFleetId(e.target.value)}
              className="select-field w-full"
            >
              <option value="">كل الأساطيل ({fleets.length})</option>
              {fleets.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Booking Status Filter */}
          <div>
            <select
              aria-label="حالة الحجز"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="select-field w-full"
            >
              <option value="all">كل حالات الحجز</option>
              <option value="CONFIRMED">مؤكد (CONFIRMED)</option>
              <option value="CANCELLED">ملغي (CANCELLED)</option>
              <option value="COMPLETED">مكتمل (COMPLETED)</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <select
              aria-label="حالة الدفع"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="select-field w-full"
            >
              <option value="all">كل حالات الدفع</option>
              <option value="PENDING">في انتظار الدفع (PENDING)</option>
              <option value="PAID">تم الدفع (PAID)</option>
              <option value="REFUND_PENDING">بانتظار الاسترداد (REFUND_PENDING)</option>
              <option value="PARTIALLY_REFUNDED">مسترد جزئياً (PARTIALLY_REFUNDED)</option>
              <option value="REFUNDED">مسترد بالكامل (REFUNDED)</option>
              <option value="FAILED">فشل الدفع (FAILED)</option>
              <option value="CANCELLED">دفع ملغي (CANCELLED)</option>
            </select>
          </div>
        </div>

        {/* Secondary Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#e4ecf2]">
          <div className="flex flex-wrap items-center gap-3">
            {/* Payment Method */}
            <select
              aria-label="طريقة الدفع"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="select-field text-xs sm:text-sm py-1.5"
            >
              <option value="all">كل طرق الدفع</option>
              <option value="VODAFONE_CASH">فودافون كاش</option>
              <option value="INSTAPAY">إنستاباي</option>
              <option value="WALLET">محفظة إلكترونية</option>
              <option value="CASH">نقدي (كاش)</option>
              <option value="CARD">بطاقة بنكية</option>
            </select>

            {/* Incidents Toggle */}
            <label className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer select-none rounded-xl border border-[#d8e4ec] bg-[#f8fbfd] px-3 py-1.5 transition hover:bg-[#edf6fc]">
              <input
                type="checkbox"
                checked={hasReports}
                onChange={(e) => setHasReports(e.target.checked)}
                className="size-4 rounded text-[#2f719e] focus:ring-[#2f719e]"
              />
              <span className="font-semibold text-red-700 flex items-center gap-1">
                <AlertTriangle className="size-3.5" />
                <span>حجوزات بها بلاغات سائقين فقط</span>
              </span>
            </label>

            {/* Toggle Advanced Dates */}
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="text-xs sm:text-sm text-[#2f719e] font-semibold hover:underline flex items-center gap-1"
            >
              <Filter className="size-3.5" />
              <span>{showAdvanced ? "إخفاء تصفية التاريخ" : "تصفية بالتواريخ"}</span>
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs sm:text-sm text-[#606060] hover:text-red-700 font-medium flex items-center gap-1 transition"
            >
              <RotateCcw className="size-3.5" />
              <span>إعادة ضبط الفلاتر</span>
            </button>
          )}
        </div>

        {/* Expandable Date Filtering */}
        {showAdvanced && (
          <div className="grid gap-3 pt-3 border-t border-[#e4ecf2] sm:grid-cols-3 animate-in fade-in duration-200">
            <div>
              <label className="block text-xs font-medium text-[#5e6b78] mb-1">نوع التاريخ</label>
              <select
                value={dateType}
                onChange={(e) => setDateType(e.target.value as "created" | "departure")}
                className="select-field w-full text-xs sm:text-sm"
              >
                <option value="departure">تاريخ موعد إقلاع الرحلة</option>
                <option value="created">تاريخ إنشاء الحجز</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5e6b78] mb-1">من تاريخ</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-xs sm:text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5e6b78] mb-1">إلى تاريخ</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-xs sm:text-sm bg-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Error Notice */}
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bookings List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/70 border border-[#e4ecf2] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d8e4ec] bg-white p-12 text-center">
          <Ticket className="size-12 mx-auto text-[#919191] mb-3 opacity-60" />
          <h3 className="text-lg font-bold text-[#10153c]">لا توجد حجوزات مطابقة</h3>
          <p className="text-sm text-[#606060] mt-1">
            لم يتم العثور على أي حجز مطابق لمعايير البحث الحالية عبر الأساطيل.
          </p>
          {hasActiveFilters && (
            <Button variant="secondary" onClick={handleResetFilters} className="mt-4 gap-2">
              <RotateCcw className="size-4" />
              <span>مسح كل الفلاتر</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#5e6b78] px-1">
            <span>عرض {items.length} حجز</span>
            <span>الترتيب: الأحدث أولاً</span>
          </div>

          <div className="flex flex-col gap-3">
            {items.map((b) => {
              const total = Number(b.totalAmount) || 0;
              const refunded = Number(b.refundedAmount) || 0;

              return (
                <Link
                  key={b.id}
                  href={`/bookings/${b.id}`}
                  className="group relative flex flex-col justify-between gap-3 rounded-2xl border border-[#e4ecf2] bg-white p-4 sm:p-5 transition hover:border-[#2f719e]/40 hover:shadow-md hover:shadow-[#204c6b]/5"
                >
                  {/* Card Header: Passenger, Fleet, Status */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#daeaf5] text-[#204c6b] font-bold text-sm">
                        <User className="size-5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-[#1a1a1a] text-base group-hover:text-[#2f719e] transition">
                            {b.passengerName}
                          </span>
                          {b.passengerPhone && (
                            <span className="flex items-center gap-1 text-xs text-[#606060]" dir="ltr">
                              <Phone className="size-3 text-[#919191]" />
                              <span>{b.passengerPhone}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#5e6b78]">
                          <span className="inline-flex items-center gap-1 text-[#204c6b] font-medium bg-[#f0f6fa] px-2 py-0.5 rounded-lg">
                            <Building2 className="size-3" />
                            <span>{b.fleetName}</span>
                          </span>
                          <span>·</span>
                          <span>{b.seats} {b.seats === 1 ? "مقعد" : b.seats === 2 ? "مقعدان" : "مقاعد"}</span>
                          <span>·</span>
                          <time dateTime={b.createdAt} className="text-[#919191]">
                            تم الحجز: {new Date(b.createdAt).toLocaleDateString("ar-EG")}
                          </time>
                        </div>
                      </div>
                    </div>

                    {/* Status badges */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Booking status */}
                      <span
                        className={
                          b.status === "CONFIRMED"
                            ? "status-pill bg-green-100 text-green-800"
                            : b.status === "CANCELLED"
                            ? "status-pill bg-red-100 text-red-800"
                            : "status-pill bg-blue-100 text-blue-800"
                        }
                      >
                        {BOOKING_STATUS_AR[b.status] ?? b.status}
                      </span>

                      {/* Payment status */}
                      <span
                        className={
                          b.paymentStatus === "PAID"
                            ? "status-pill bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : b.paymentStatus === "PENDING"
                            ? "status-pill bg-amber-50 text-amber-800 border border-amber-200"
                            : b.paymentStatus === "FAILED"
                            ? "status-pill bg-red-50 text-red-700 border border-red-200"
                            : b.paymentStatus === "REFUNDED" || b.paymentStatus === "PARTIALLY_REFUNDED"
                            ? "status-pill bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : "status-pill bg-slate-100 text-slate-700"
                        }
                      >
                        {PAYMENT_STATUS_AR[b.paymentStatus] ?? b.paymentStatus}
                      </span>

                      {/* Incident report indicator */}
                      {b.hasReports && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-extrabold text-white shadow-sm">
                          <AlertTriangle className="size-3" />
                          <span>بلاغ سائق</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Trip Route & Schedule */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f8fbfd] p-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="size-4 text-[#2f719e] shrink-0 rotate-90" />
                      <span className="font-semibold text-[#1a1a1a]">
                        {b.originName ?? "نقطة البداية"} ← {b.destinationName ?? "الوجهة"}
                      </span>
                      {b.tripDepartureTime && (
                        <span className="text-xs text-[#5e6b78] flex items-center gap-1 ms-2">
                          <Clock className="size-3 text-[#919191]" />
                          <span>{new Date(b.tripDepartureTime).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}</span>
                        </span>
                      )}
                    </div>

                    {/* Commercial / Payment summary */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#5e6b78] bg-white border border-[#d8e4ec] px-2 py-0.5 rounded-md">
                        {PAYMENT_METHOD_AR[b.paymentMethod] ?? b.paymentMethod}
                      </span>
                      <div className="text-end">
                        <span className="font-extrabold text-[#10153c] text-sm sm:text-base" dir="ltr">
                          {b.totalAmount} EGP
                        </span>
                        {refunded > 0 && (
                          <span className="block text-[11px] text-[#e16800] font-medium" dir="ltr">
                            مسترد: {b.refundedAmount} EGP
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Operational indicators footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5e6b78] pt-1">
                    <div className="flex items-center gap-3">
                      {b.boardedAt ? (
                        <span className="text-green-700 font-medium flex items-center gap-1">
                          <CheckCircle2 className="size-3.5" />
                          <span>صعد للميكروباص</span>
                        </span>
                      ) : (
                        <span className="text-[#919191]">لم يسجل صعوده بعد</span>
                      )}

                      {b.dropStatus === "DROPPED_OFF" && (
                        <span className="text-blue-700 font-medium">· نزل بالمحطة</span>
                      )}
                    </div>

                    <span className="text-[#2f719e] font-bold group-hover:underline flex items-center gap-1">
                      <span>عرض تفاصيل الحجز والفحص</span>
                      <span dir="ltr">←</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Load More Affordance (Cursor pagination) */}
          {nextCursor && (
            <div className="pt-4 flex justify-center">
              <Button
                type="button"
                variant="secondary"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-8 font-bold text-[#204c6b] hover:bg-[#c4def3]"
              >
                {loadingMore ? "جاري تحميل المزيد…" : "عرض المزيد من الحجوزات"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
