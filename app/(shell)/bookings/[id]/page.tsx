"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import {
  fetchAdminBookingDetail,
  BOOKING_STATUS_AR,
  PAYMENT_STATUS_AR,
  PAYMENT_METHOD_AR,
  DROP_STATUS_AR,
  REPORT_STATUS_AR,
  type AdminBookingDetail,
  type IncidentReport,
} from "@/lib/actions/bookings";
import {
  VerifyPaymentDialog,
  FailPaymentDialog,
  RefundPaymentDialog,
  ForceCancelDialog,
  ReinstateDialog,
  OperationalOverrideDialog,
  ResolveReportDialog,
} from "@/components/bookings/booking-action-dialogs";
import {
  ArrowRight,
  Ticket,
  User,
  Phone,
  CreditCard,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Bus,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Star,
  FileText,
  History,
  IdCard,
  Check,
  X,
  Building2,
  Settings2,
} from "lucide-react";

type AuditLog = AdminBookingDetail["auditTrail"][number];

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [booking, setBooking] = useState<AdminBookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  // Dialog visibility states
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reinstateOpen, setReinstateOpen] = useState(false);
  const [operationalOpen, setOperationalOpen] = useState(false);
  const [reportModal, setReportModal] = useState<{ open: boolean; report: IncidentReport | null }>({
    open: false,
    report: null,
  });

  const [reloadKey, setReloadKey] = useState(0);

  const auditColumns: CommunityColumnDef<AuditLog>[] = [
    { field: "createdAt", headerName: "التاريخ والتوقيت", filter: "agDateColumnFilter", valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString("ar-EG") : "—" },
    { field: "action", headerName: "العملية الإدارية", filter: "agTextColumnFilter" },
    { field: "actorUserId", headerName: "المشرف / الفاعل", valueFormatter: (params) => params.value ? `${String(params.value).slice(0, 8)}…` : "نظام" },
    { field: "metadata", headerName: "التفاصيل والبيانات الوصفية", valueFormatter: (params) => params.value ? JSON.stringify(params.value) : "—" },
  ];

  useEffect(() => {
    let cancelled = false;
    fetchAdminBookingDetail(id).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok) {
        setBooking(res.data);
        setError(null);
      } else {
        setError(res.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  function handleActionSuccess(note?: string) {
    if (note) {
      setSuccessNote(note);
      setTimeout(() => setSuccessNote(null), 5000);
    }
    setReloadKey((k) => k + 1);
  }

  if (loading) {
    return (
      <div className="dashboard-page space-y-4 animate-pulse">
        <div className="h-10 w-48 bg-white/60 rounded-xl" />
        <div className="h-32 bg-white/70 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-64 bg-white/70 rounded-2xl" />
          <div className="h-64 bg-white/70 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="dashboard-page">
        <div className="mb-4">
          <Button variant="secondary" asChild className="gap-2">
            <Link href="/bookings">
              <ArrowRight className="size-4" />
              <span>العودة لقائمة الحجوزات</span>
            </Link>
          </Button>
        </div>
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
          <AlertTriangle className="size-8 mx-auto mb-2 text-red-600" />
          <h2 className="text-lg font-bold">تعذر تحميل بيانات الحجز</h2>
          <p className="text-sm mt-1">{error ?? "الحجز غير موجود"}</p>
        </div>
      </div>
    );
  }

  const total = Number(booking.totalAmount) || 0;
  const refunded = Number(booking.refundedAmount) || 0;
  const remaining = Math.max(0, total - refunded);

  const isCancelled = booking.status === "CANCELLED";
  const isPaid = booking.paymentStatus === "PAID";
  const isRefunded = booking.paymentStatus === "REFUNDED";
  const isPendingPayment = booking.paymentStatus === "PENDING";
  const canRefund = remaining > 0 && booking.paymentMethod !== "CASH";

  return (
    <div className="dashboard-page space-y-6">
      {/* Top Breadcrumb & Return Link */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" asChild className="gap-2 text-xs sm:text-sm">
          <Link href="/bookings">
            <ArrowRight className="size-4" />
            <span>العودة للحجوزات</span>
          </Link>
        </Button>
        <span className="text-xs text-[#5e6b78]" dir="ltr">
          UUID: {booking.id}
        </span>
      </div>

      {/* Success Notification Banner */}
      {successNote && (
        <div role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 animate-in fade-in duration-200">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          <span>{successNote}</span>
        </div>
      )}

      {/* Main Inspection Header Card */}
      <div className="rounded-2xl border border-[#daeaf5] bg-white p-5 sm:p-7 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid size-10 place-items-center rounded-xl bg-[#10153c] text-white">
                <Ticket className="size-5" />
              </span>
              <h1 className="text-2xl font-black text-[#10153c]">
                حجز: {booking.passenger?.name ?? "راكب غير مسمى"}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-lg bg-[#daeaf5] px-2.5 py-0.5 text-xs font-bold text-[#204c6b]">
                <Building2 className="size-3.5" />
                <span>{booking.fleetName}</span>
              </span>
            </div>
            <p className="mt-1.5 text-xs sm:text-sm text-[#5e6b78]">
              رقم الحجز: <span className="font-mono text-[#1a1a1a]" dir="ltr">#{booking.id.slice(0, 12)}</span> · عدد المقاعد:{" "}
              <strong className="text-[#1a1a1a]">{booking.seats}</strong> · تاريخ الحجز:{" "}
              {booking.confirmedAt ? new Date(booking.confirmedAt).toLocaleString("ar-EG") : "—"}
            </p>
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Booking Status Pill */}
            <span
              className={
                booking.status === "CONFIRMED"
                  ? "status-pill bg-green-100 text-green-800 text-sm px-3 py-1 font-bold"
                  : booking.status === "CANCELLED"
                  ? "status-pill bg-red-100 text-red-800 text-sm px-3 py-1 font-bold"
                  : "status-pill bg-blue-100 text-blue-800 text-sm px-3 py-1 font-bold"
              }
            >
              {BOOKING_STATUS_AR[booking.status] ?? booking.status}
            </span>

            {/* Payment Status Pill */}
            <span
              className={
                booking.paymentStatus === "PAID"
                  ? "status-pill bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm px-3 py-1 font-bold"
                  : booking.paymentStatus === "PENDING"
                  ? "status-pill bg-amber-50 text-amber-800 border border-amber-200 text-sm px-3 py-1 font-bold"
                  : booking.paymentStatus === "FAILED"
                  ? "status-pill bg-red-50 text-red-700 border border-red-200 text-sm px-3 py-1 font-bold"
                  : booking.paymentStatus === "REFUNDED" || booking.paymentStatus === "PARTIALLY_REFUNDED"
                  ? "status-pill bg-indigo-50 text-indigo-700 border border-indigo-200 text-sm px-3 py-1 font-bold"
                  : "status-pill bg-slate-100 text-slate-700 text-sm px-3 py-1 font-bold"
              }
            >
              {PAYMENT_STATUS_AR[booking.paymentStatus] ?? booking.paymentStatus}
            </span>
          </div>
        </div>

        {/* Global Administrative Quick Actions Toolbar */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#e4ecf2]">
          <span className="text-xs font-bold text-[#5e6b78] me-1">إجراءات المشرف:</span>

          {/* Payment Verification */}
          {!isPaid && !isRefunded && (
            <Button
              type="button"
              size="sm"
              onClick={() => setVerifyOpen(true)}
              className="gap-1.5 bg-[#2f719e] hover:bg-[#204c6b]"
            >
              <CheckCircle2 className="size-4" />
              <span>تأكيد الدفع (Verify)</span>
            </Button>
          )}

          {/* Mark Payment Failed */}
          {isPendingPayment && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => setFailOpen(true)}
              className="gap-1.5"
            >
              <XCircle className="size-4" />
              <span>تسجيل فشل الدفع</span>
            </Button>
          )}

          {/* Refund */}
          {canRefund && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setRefundOpen(true)}
              className="gap-1.5 border border-[#2f719e]/30 text-[#204c6b] hover:bg-[#daeaf5]"
            >
              <RotateCcw className="size-4" />
              <span>استرداد مالي (Refund)</span>
            </Button>
          )}

          {/* Operational Override */}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setOperationalOpen(true)}
            className="gap-1.5 border border-[#d8e4ec]"
          >
            <Settings2 className="size-4" />
            <span>تعديل تشغيلي (Override)</span>
          </Button>

          {/* Cancel or Reinstate */}
          {isCancelled ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setReinstateOpen(true)}
              className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              <RotateCcw className="size-4" />
              <span>استرجاع الحجز (Reinstate)</span>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => setCancelOpen(true)}
              className="gap-1.5"
            >
              <XCircle className="size-4" />
              <span>إلغاء إداري (Force Cancel)</span>
            </Button>
          )}
        </div>
      </div>

      {/* Grid: 2 columns for structured relational inspection */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card 1: Passenger Profile */}
        <div className="panel-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#e4ecf2] pb-3">
            <User className="size-5 text-[#2f719e]" />
            <h2 className="text-lg font-bold text-[#10153c]">بيانات الراكب المسافر</h2>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[#5e6b78]">اسم الراكب:</span>
              <span className="font-bold text-[#1a1a1a]">{booking.passenger?.name ?? "—"}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#5e6b78]">رقم الموبايل:</span>
              <div className="flex items-center gap-1.5 font-semibold text-[#1a1a1a]">
                <span dir="ltr">{booking.passenger?.phoneNumber ?? "—"}</span>
                {booking.passenger?.phoneVerifiedAt ? (
                  <span className="inline-flex items-center gap-0.5 rounded bg-green-100 px-1.5 py-0.2 text-[10px] font-bold text-green-800" title="الموبايل موثق">
                    <Check className="size-3" /> موثق
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600">
                    غير موثق
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#5e6b78]">الرقم القومي:</span>
              <span className="font-mono text-[#1a1a1a]" dir="ltr">
                {booking.passenger?.nationalId ?? "غير مسجل"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#5e6b78]">معرف المستخدم (User ID):</span>
              <span className="font-mono text-xs text-[#5e6b78]" dir="ltr">
                {booking.passenger?.id ? `${booking.passenger.id.slice(0, 16)}…` : "—"}
              </span>
            </div>

            <div className="rounded-xl bg-[#f8fbfd] p-3">
              <p className="mb-2 text-xs font-bold text-[#71808d]">بيانات الحجز المحفوظة تاريخيًا + <span className={booking.bookingFor === "OTHER" ? "status-pill" : "status-pill status-pill-muted"}>{booking.bookingFor === "OTHER" ? "لراكب آخر" : "لنفسه"}</span></p>
              <div className="flex justify-between items-center">
                <span className="text-[#5e6b78]">الاسم المحفوظ:</span>
                <span className="font-bold text-[#1a1a1a]">{booking.passengerName ?? "—"}</span>
              </div>
              <div className="mt-2 flex justify-between items-center">
                <span className="text-[#5e6b78]">الموبايل المحفوظ:</span>
                <span dir="ltr" className="font-semibold text-[#1a1a1a]">{booking.passengerPhone ?? "—"}</span>
              </div>
              {booking.note ? <p className="mt-2 border-t border-[#e4ecf2] pt-2 text-[#1a1a1a]">ملاحظة: {booking.note}</p> : null}
              {booking.promoCode ? <p className="mt-2 border-t border-[#e4ecf2] pt-2 text-[#1a1a1a]">كود الخصم: <span dir="ltr" className="font-mono font-bold">{booking.promoCode}</span>{booking.discountAmount ? <span> (خصم {booking.discountAmount} جنيه)</span> : null}</p> : null}
            </div>
          </div>
        </div>

        {/* Card 2: Trip, Bus & Driver */}
        <div className="panel-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#e4ecf2] pb-3">
            <Bus className="size-5 text-[#2f719e]" />
            <h2 className="text-lg font-bold text-[#10153c]">تفاصيل الرحلة والمركبة والسائق</h2>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[#5e6b78]">خط السير:</span>
              <span className="font-extrabold text-[#1a1a1a]">
                {booking.trip.originName} ← {booking.trip.destinationName}
              </span>
            </div>

            {(booking.boardingStationName || booking.landingStationName || booking.boardingStationId || booking.landingStationId) && (
              <div className="rounded-xl border border-[#daeaf5] bg-[#f8fbfd] p-2.5 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[#5e6b78]">محطة الركوب:</span>
                  <span className="font-bold text-[#1a1a1a]">
                    {booking.boardingStationName ?? (booking.boardingStationId ? `معرف: ${booking.boardingStationId.slice(0, 8)}…` : "نقطة الانطلاق")}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-[#e4ecf2] pt-1.5">
                  <span className="text-[#5e6b78]">محطة النزول:</span>
                  <span className="font-bold text-[#1a1a1a]">
                    {booking.landingStationName ?? (booking.landingStationId ? `معرف: ${booking.landingStationId.slice(0, 8)}…` : "نقطة الوصول")}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-[#5e6b78]">موعد الإقلاع:</span>
              <span className="font-semibold text-[#1a1a1a] flex items-center gap-1">
                <Clock className="size-3.5 text-[#2f719e]" />
                <time dateTime={booking.trip.departureTime}>
                  {new Date(booking.trip.departureTime).toLocaleString("ar-EG")}
                </time>
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#5e6b78]">سعر المقعد / الإجمالي:</span>
              <span className="font-bold text-[#10153c]" dir="ltr">
                {booking.trip.fare} EGP / مقعد
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#5e6b78]">الأتوبيس / المركبة:</span>
              <span className="font-semibold text-[#1a1a1a]">
                {booking.trip.bus ? (
                  <>
                    رقم التسجيل: <span className="font-bold" dir="ltr">{booking.trip.bus.registrationNumber}</span> · السعة: {booking.trip.bus.capacity} كراسي
                  </>
                ) : (
                  "لم يتم تعيين حافلة"
                )}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#5e6b78]">المقاعد المتاحة حالياً بالرحلة:</span>
              <span className="font-bold text-blue-700">{booking.trip.availableSeats} مقعد</span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[#f0f4f8]">
              <span className="text-[#5e6b78]">السائق المسؤول:</span>
              <span className="font-bold text-[#1a1a1a]">
                {booking.trip.driver ? (
                  <>
                    {booking.trip.driver.name}{" "}
                    {booking.trip.driver.phoneNumber && (
                      <span className="text-xs text-[#5e6b78]" dir="ltr">
                        ({booking.trip.driver.phoneNumber})
                      </span>
                    )}
                  </>
                ) : (
                  "لم يتم تعيين سائق"
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Financial Reconciliation & Settlement */}
        <div className="panel-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#e4ecf2] pb-3">
            <CreditCard className="size-5 text-[#2f719e]" />
            <h2 className="text-lg font-bold text-[#10153c]">المعاملات المالية والتسوية</h2>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[#5e6b78]">طريقة الدفع:</span>
              <span className="font-bold text-[#1a1a1a]">
                {PAYMENT_METHOD_AR[booking.paymentMethod] ?? booking.paymentMethod}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#5e6b78]">إجمالي قيمة الحجز:</span>
              <span className="font-extrabold text-base text-[#10153c]" dir="ltr">
                {booking.totalAmount} EGP
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#5e6b78]">المبلغ المسترد تراكمياً:</span>
              <span className="font-bold text-[#e16800]" dir="ltr">
                {booking.refundedAmount} EGP
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#5e6b78]">الرصيد المتبقي القابل للاسترداد:</span>
              <span className="font-bold text-green-700" dir="ltr">
                {remaining.toFixed(2)} EGP
              </span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[#f0f4f8]">
              <span className="text-[#5e6b78]">المرجع الخارجي للتحويل:</span>
              <span className="font-mono font-bold text-[#204c6b]" dir="ltr">
                {booking.paymentReference ?? "غير متوفر"}
              </span>
            </div>

            {booking.paymentNotes && (
              <div className="rounded-xl bg-[#f8fbfd] p-2.5 text-xs text-[#5e6b78]">
                <strong className="block text-[#1a1a1a] mb-0.5">ملاحظات التحقق:</strong>
                {booking.paymentNotes}
              </div>
            )}

            {booking.paidAt && (
              <div className="flex justify-between items-center text-xs text-[#5e6b78]">
                <span>توقيت توثيق الدفع:</span>
                <time dateTime={booking.paidAt}>{new Date(booking.paidAt).toLocaleString("ar-EG")}</time>
              </div>
            )}

            {booking.cancellationReason && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                <strong className="block font-bold mb-0.5">سبب الإلغاء الإداري:</strong>
                {booking.cancellationReason}
                {booking.cancelledAt && (
                  <time className="block text-[11px] text-red-600 mt-1" dateTime={booking.cancelledAt}>
                    أُلغي بتاريخ: {new Date(booking.cancelledAt).toLocaleString("ar-EG")}
                  </time>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Operational Lifecycle (Boarding & Drop) */}
        <div className="panel-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#e4ecf2] pb-3">
            <Clock className="size-5 text-[#2f719e]" />
            <h2 className="text-lg font-bold text-[#10153c]">الحالة التشغيلية والصعود</h2>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[#5e6b78]">حالة الصعود للأتوبيس:</span>
              {booking.boardedAt ? (
                <span className="font-bold text-green-700 flex items-center gap-1">
                  <CheckCircle2 className="size-4" />
                  <span>تم الصعود بنجاح</span>
                </span>
              ) : (
                <span className="text-[#919191] font-medium">لم يسجل الصعود بعد</span>
              )}
            </div>

            {booking.boardedAt && (
              <div className="flex justify-between items-center text-xs text-[#5e6b78]">
                <span>توقيت الصعود:</span>
                <time dateTime={booking.boardedAt}>{new Date(booking.boardedAt).toLocaleString("ar-EG")}</time>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-[#f0f4f8]">
              <span className="text-[#5e6b78]">حالة النزول بالمحطة:</span>
              <span className="font-bold text-[#1a1a1a]">
                {booking.dropStatus ? DROP_STATUS_AR[booking.dropStatus] ?? booking.dropStatus : "غير محدد"}
              </span>
            </div>

            {booking.dropStationId && (
              <div className="flex justify-between items-center text-xs text-[#5e6b78]">
                <span>محطة النزول:</span>
                <span className="font-mono text-[#1a1a1a]" dir="ltr">{booking.dropStationId}</span>
              </div>
            )}

            {booking.dropReason && (
              <div className="rounded-xl bg-[#f8fbfd] p-2.5 text-xs text-[#5e6b78]">
                <strong className="block text-[#1a1a1a] mb-0.5">ملاحظة النزول:</strong>
                {booking.dropReason}
              </div>
            )}
          </div>
        </div>

        {/* Card 5: Service Ratings */}
        <div className="panel-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#e4ecf2] pb-3">
            <Star className="size-5 text-[#2f719e]" />
            <h2 className="text-lg font-bold text-[#10153c]">تقييمات الرحلة المتبادلة</h2>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-[#e4ecf2] bg-[#f8fbfd] p-3">
              <span className="text-xs text-[#5e6b78] block mb-1">تقييم الأتوبيس</span>
              <div className="flex items-center justify-center gap-1 font-extrabold text-lg text-amber-600">
                <Star className="size-4 fill-amber-500 text-amber-500" />
                <span>{booking.ratings?.busRating ?? "—"}</span>
              </div>
            </div>

            <div className="rounded-xl border border-[#e4ecf2] bg-[#f8fbfd] p-3">
              <span className="text-xs text-[#5e6b78] block mb-1">تقييم السائق</span>
              <div className="flex items-center justify-center gap-1 font-extrabold text-lg text-amber-600">
                <Star className="size-4 fill-amber-500 text-amber-500" />
                <span>{booking.ratings?.driverRating ?? "—"}</span>
              </div>
            </div>

            <div className="rounded-xl border border-[#e4ecf2] bg-[#f8fbfd] p-3">
              <span className="text-xs text-[#5e6b78] block mb-1">تقييم الراكب</span>
              <div className="flex items-center justify-center gap-1 font-extrabold text-lg text-amber-600">
                <Star className="size-4 fill-amber-500 text-amber-500" />
                <span>{booking.ratings?.passengerRating ?? "—"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 6: Incident Reports */}
        <div className="panel-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#e4ecf2] pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-red-600" />
              <h2 className="text-lg font-bold text-[#10153c]">بلاغات السائق ضد الراكب ({booking.reports.length})</h2>
            </div>
          </div>

          {booking.reports.length === 0 ? (
            <div className="text-center py-6 text-sm text-[#5e6b78]">
              <CheckCircle2 className="size-8 mx-auto mb-2 text-emerald-600 opacity-60" />
              <span>لا توجد أي بلاغات مسجلة من السائق حول هذا الراكب.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {booking.reports.map((rep) => (
                <div key={rep.id} className="rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-red-900">مذكرة السائق:</span>
                    <span
                      className={
                        rep.status === "RESOLVED"
                          ? "status-pill bg-green-100 text-green-800 text-xs"
                          : rep.status === "DISMISSED"
                          ? "status-pill bg-slate-100 text-slate-700 text-xs"
                          : "status-pill bg-amber-100 text-amber-800 text-xs font-bold"
                      }
                    >
                      {REPORT_STATUS_AR[rep.status] ?? rep.status}
                    </span>
                  </div>
                  <p className="text-[#1a1a1a] leading-relaxed">{rep.note}</p>

                  {rep.resolutionNote && (
                    <div className="rounded-lg bg-white p-2.5 text-xs text-[#204c6b] border border-blue-100 mt-2">
                      <strong>قرار الإدارة:</strong> {rep.resolutionNote}
                      {rep.resolvedAt && (
                        <span className="block text-[11px] text-[#5e6b78] mt-1">
                          تاريخ الحل: {new Date(rep.resolvedAt).toLocaleString("ar-EG")}
                        </span>
                      )}
                    </div>
                  )}

                  {rep.status === "PENDING" && (
                    <div className="pt-2 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setReportModal({ open: true, report: rep })}
                        className="gap-1 bg-red-700 hover:bg-red-800 text-xs"
                      >
                        <ShieldCheck className="size-3.5" />
                        <span>معالجة البلاغ</span>
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Card 7: Inline Administrative Audit Trail (Full Width) */}
      <div className="panel-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-[#e4ecf2] pb-3">
          <History className="size-5 text-[#2f719e]" />
          <h2 className="text-lg font-bold text-[#10153c]">سجل التدقيق الإداري للعمليات (Audit Trail)</h2>
        </div>

        <AgGridTable<AuditLog>
          gridId={`booking-audit-${booking.id}`}
          rows={booking.auditTrail}
          columnDefs={auditColumns}
          emptyMessage="لا توجد عمليات تدقيق مسجلة حتى الآن."
          getRowId={(log) => log.id}
        />
      </div>

      {/* Action Dialogs */}
      <VerifyPaymentDialog
        booking={booking}
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        onSuccess={handleActionSuccess}
      />

      <FailPaymentDialog
        booking={booking}
        open={failOpen}
        onOpenChange={setFailOpen}
        onSuccess={handleActionSuccess}
      />

      <RefundPaymentDialog
        booking={booking}
        open={refundOpen}
        onOpenChange={setRefundOpen}
        onSuccess={handleActionSuccess}
      />

      <ForceCancelDialog
        booking={booking}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onSuccess={handleActionSuccess}
      />

      <ReinstateDialog
        booking={booking}
        open={reinstateOpen}
        onOpenChange={setReinstateOpen}
        onSuccess={handleActionSuccess}
      />

      <OperationalOverrideDialog
        booking={booking}
        open={operationalOpen}
        onOpenChange={setOperationalOpen}
        onSuccess={handleActionSuccess}
      />

      <ResolveReportDialog
        bookingId={booking.id}
        report={reportModal.report}
        open={reportModal.open}
        onOpenChange={(open) => setReportModal({ open, report: open ? reportModal.report : null })}
        onSuccess={handleActionSuccess}
      />
    </div>
  );
}
