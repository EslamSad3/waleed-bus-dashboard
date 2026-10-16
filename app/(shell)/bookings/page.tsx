"use client";

import { Suspense, useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Eye, Filter, Plus, RotateCcw, Ticket, Trash2 } from "lucide-react";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFieldValidation, ValidationScope } from "@/components/ui/field-validation";
import { schemaErrors } from "@/lib/field-validation";
import { dateRangeSchema } from "@/lib/schemas/admin-forms";
import {
  BOOKING_STATUS_AR,
  deleteBooking,
  PAYMENT_METHOD_AR,
  PAYMENT_STATUS_AR,
  type AdminBookingFilterParams,
} from "@/lib/actions/bookings";
import type { AdminBookingSummary } from "@/lib/actions/booking-summaries";
import { useBookingSummaries } from "@/lib/use-booking-summaries";
import { GroupedBookingDetailsDialog } from "@/components/bookings/grouped-booking-details-dialog";
import { findTripAcrossLines } from "@/lib/actions/trips";
import { CreateGroupBookingDialog } from "@/components/bookings/create-group-booking-dialog";
import { fetchSessionIdentity } from "@/lib/actions/session";
import { can } from "@/lib/access";
import { fetchFleetOwnersPage } from "@/lib/actions/fleet-owners";
import { RowActions } from "@/components/ui/row-actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { InlineBlockSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { applyMutationCache, bookingImpact } from "@/lib/cache/mutations";
import { t } from "@/lib/i18n/t";

function BookingsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState("");
  // Trip scope is fully URL-driven: /bookings?tripId=X always filters to that
  // trip, including when the page is already mounted and only the param changes.
  const tripId = searchParams.get("tripId") ?? "";
  const selectedBookingId = searchParams.get("bookingId");
  // The trip banner is opened from a trip page, which knows its owner company.
  const ownerIdFromLink = searchParams.get("ownerId") ?? "";
  const [ownerId, setOwnerId] = useState("");
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [hasReports, setHasReports] = useState(false);
  const [dateType, setDateType] = useState<"created" | "departure">("departure");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const dateErrors = schemaErrors(dateRangeSchema, { fromDate, toDate });
  const invalidDates = Object.keys(dateErrors).length > 0;
  const dateValidation = useFieldValidation(() => dateErrors);

  const [tripLabel, setTripLabel] = useState<{ tripId: string; text: string } | null>(null);
  useEffect(() => {
    if (!tripId || !ownerIdFromLink) return;
    let cancelled = false;
    findTripAcrossLines(ownerIdFromLink, tripId).then((result) => {
      if (cancelled) return;
      const text = result.ok
        ? `${result.data.trip.origin} ← ${result.data.trip.destination} • ${new Date(result.data.trip.departAt).toLocaleString("ar-EG")}`
        : tripId;
      setTripLabel({ tripId, text });
    });
    return () => { cancelled = true; };
  }, [tripId, ownerIdFromLink]);
  const activeTripLabel = tripLabel && tripLabel.tripId === tripId ? tripLabel.text : null;

  const buildFilterParams = useCallback((): AdminBookingFilterParams => {
    const params: AdminBookingFilterParams = { limit: 20 };
    if (ownerId) params.ownerId = ownerId;
    if (tripId) params.tripId = tripId;
    if (searchTerm.trim()) {
      if (/^\+?[0-9]+$/.test(searchTerm.trim())) params.passengerPhone = searchTerm.trim();
      else params.passengerName = searchTerm.trim();
    }
    if (status !== "all") params.status = status;
    if (paymentStatus !== "all") params.paymentStatus = paymentStatus;
    if (paymentMethod !== "all") params.paymentMethod = paymentMethod;
    if (hasReports) params.hasReports = true;
    if (!invalidDates && dateType === "departure") {
      if (fromDate) params.departureFrom = new Date(fromDate).toISOString();
      if (toDate) { const date = new Date(toDate); date.setHours(23, 59, 59, 999); params.departureTo = date.toISOString(); }
    } else if (!invalidDates) {
      if (fromDate) params.createdFrom = new Date(fromDate).toISOString();
      if (toDate) { const date = new Date(toDate); date.setHours(23, 59, 59, 999); params.createdTo = date.toISOString(); }
    }
    return params;
  }, [ownerId, tripId, searchTerm, status, paymentStatus, paymentMethod, hasReports, dateType, fromDate, toDate, invalidDates]);

  const filterParams = buildFilterParams();
  const { data: owners } = useApiQuery(qk.fleetOwners, () => fetchFleetOwnersPage(null));
  // Session identity (live /api/auth/me) gates the staff checkout button —
  // platform_staff only see it with bookings.create; super_admin always can.
  const { data: identity } = useApiQuery(qk.session, fetchSessionIdentity);
  const canCreate = can(identity ?? null, "bookings.create");
  const bookingQuery = useBookingSummaries(filterParams, { enabled: !invalidDates });
  const items = bookingQuery.items;
  const nextCursor = bookingQuery.nextCursor;
  const isPending = bookingQuery.isPending;
  const fetchError = bookingQuery.error;
  const error = fetchError?.message ?? null;

  async function removeBooking(booking: AdminBookingSummary) {
    // The available delete endpoint deletes one operational seat, not a group.
    if (booking.orderId) return;
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("bookings.list.deleteConfirm.description", { value: booking.passengerName || booking.passengerPhone || "" }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteBooking(booking.ownerId, booking.id);
    if (!result.ok) return;
    applyMutationCache(queryClient, bookingImpact(booking.ownerId, booking, "remove"), result);
  }

  function closeGroupedBooking() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("bookingId");
    router.replace(params.size ? `/bookings?${params.toString()}` : "/bookings", { scroll: false });
  }

  function detailsHref(booking: AdminBookingSummary) {
    if (!booking.orderId) return `/bookings/${booking.id}`;
    const params = new URLSearchParams(searchParams.toString());
    params.set("bookingId", booking.orderId);
    return `/bookings?${params.toString()}`;
  }

  function resetFilters() {
    startTransition(() => {
      setSearchTerm("");
      setOwnerId("");
      setStatus("all");
      setPaymentStatus("all");
      setPaymentMethod("all");
      setHasReports(false);
      setFromDate("");
      setToDate("");
    });
    if (tripId) router.replace("/bookings");
  }

  const hasActiveFilters = Boolean(searchTerm || tripId || ownerId || hasReports || fromDate || toDate) || status !== "all" || paymentStatus !== "all" || paymentMethod !== "all";
  const columns: CommunityColumnDef<AdminBookingSummary>[] = [
    { field: "passengerName", headerName: t("bookings.columns.passengers"), minWidth: 220, wrapText: true, autoHeight: true, filter: "agTextColumnFilter" },
    { field: "seats", headerName: t("common.fields.seats"), width: 110, minWidth: 100, filter: "agNumberColumnFilter" },
    { field: "passengerPhone", headerName: t("common.fields.phone"), minWidth: 180, wrapText: true, autoHeight: true, filter: "agTextColumnFilter" },
    { field: "fleetName", headerName: t("common.fields.owner"), filter: "agTextColumnFilter" },
    { field: "originName", headerName: t("common.fields.origin") },
    { field: "destinationName", headerName: t("common.fields.destination") },
    { field: "id", headerName: t("bookings.detail.orderSection.bookingReference"), minWidth: 280, wrapText: true, autoHeight: true },
    { field: "status", headerName: t("common.fields.bookingStatus"), valueFormatter: (params) => params.value === "PARTIALLY_CANCELLED" ? t("bookings.detail.orderSection.status.PARTIALLY_CANCELLED") : BOOKING_STATUS_AR[params.value as keyof typeof BOOKING_STATUS_AR] ?? params.value },
    { field: "paymentStatus", headerName: t("common.fields.paymentStatus"), valueFormatter: (params) => params.value === "MIXED" ? t("bookings.groupedDetails.mixedPayment") : PAYMENT_STATUS_AR[params.value as keyof typeof PAYMENT_STATUS_AR] ?? params.value ?? t("common.value.unpaid") },
    { field: "paymentMethod", headerName: t("common.fields.paymentMethod"), valueFormatter: (params) => PAYMENT_METHOD_AR[params.value as keyof typeof PAYMENT_METHOD_AR] ?? params.value },
    { field: "totalAmount", headerName: t("common.fields.total"), filter: "agNumberColumnFilter", valueFormatter: (params) => {
      const raw = params.value ?? (params.data as AdminBookingSummary | undefined)?.totalAmount;
      if (raw === null || raw === undefined || raw === "") return "—";
      const num = Number(raw);
      return Number.isNaN(num) ? String(raw) : `${num} EGP`;
    } },
    { field: "hasReports", headerName: t("bookings.columns.hasReports"), filter: "agTextColumnFilter", cellDataType: "text", valueFormatter: (params) => params.value == null ? "—" : params.value ? t("common.value.yes") : t("common.value.no") },
    { field: "createdAt", headerName: t("bookings.columns.createdAt"), filter: "agDateColumnFilter", valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString("ar-EG") : "—" },
    { colId: "actions", headerName: t("cursorList.actionsColumn"), pinned: "left", width: 300,
      sortable: false, filter: false, exportable: false,
      cellRenderer: ({ data: booking }: { data: AdminBookingSummary }) => (
        <RowActions label={t("bookings.list.rowActions", { value: booking.passengerName || booking.passengerPhone || "" })}
          actions={[
            { label: t("common.actions.openDetails"), icon: Eye, href: detailsHref(booking) },
            ...(!booking.orderId ? [{ label: t("common.actions.delete"), icon: Trash2, tone: "danger" as const, onSelect: () => void removeBooking(booking) }] : []),
          ]} />
      ),
    },
  ];

  return (
    <div className="dashboard-page space-y-6">
      <div className="page-heading">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#d6eeff] text-[#00134c]"><Ticket className="size-5" /></span><h1 className="page-title min-w-0">{t("bookings.list.badge")}</h1></div>
          <p className="page-description">{t("bookings.list.description")}</p>
        </div>
        {canCreate ? (
          <Button className="gap-2" onClick={() => setCreateOpen(true)}><Plus className="size-4" /> {t("bookings.list.newBooking")}</Button>
        ) : null}
      </div>

      {tripId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d6eeff] bg-[#f3f8fc] p-4 shadow-sm">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#00134c]">{t("bookings.list.tripBookingsTitle")}</p>
            <p className="text-xs text-[#606060]">{activeTripLabel ? <span dir="auto">{activeTripLabel}</span> : <InlineBlockSkeleton className="h-3.5 w-44" />}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="secondary"><Link href={`/trips/${tripId}?ownerId=${ownerIdFromLink}`}>{t("bookings.list.tripDetails")}</Link></Button>
            <Button size="sm" variant="outline" onClick={() => router.replace("/bookings")}>{t("bookings.list.showAllBookings")}</Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[#d6eeff] bg-white p-4 shadow-sm space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input aria-label={t("bookings.filters.searchAria")} placeholder={t("bookings.filters.searchPlaceholder")} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="bg-white" />
          <select aria-label={t("common.fields.owner")} value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="select-field w-full"><option value="">{t("bookings.filters.allOwners")}</option>{(owners?.items ?? []).map((owner) => <option key={owner.id} value={owner.id}>{owner.name || owner.nickname || owner.phoneNumber || owner.id}</option>)}</select>
          <select aria-label={t("common.fields.bookingStatus")} value={status} onChange={(event) => setStatus(event.target.value)} className="select-field w-full"><option value="all">{t("bookings.filters.allStatuses")}</option><option value="CONFIRMED">{t("enums.bookingStatus.confirmed")}</option><option value="CANCELLED">{t("enums.bookingStatus.cancelled")}</option><option value="COMPLETED">{t("enums.bookingStatus.completed")}</option><option value="PARTIALLY_CANCELLED">{t("bookings.detail.orderSection.status.PARTIALLY_CANCELLED")}</option></select>
          <select aria-label={t("common.fields.paymentStatus")} value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} className="select-field w-full"><option value="all">{t("bookings.filters.allPaymentStatuses")}</option><option value="PENDING">{t("enums.paymentStatus.pending")}</option><option value="PAID">{t("enums.paymentStatus.paid")}</option><option value="REFUNDED">{t("enums.paymentStatus.refunded")}</option><option value="FAILED">{t("enums.paymentStatus.failed")}</option><option value="MIXED">{t("bookings.groupedDetails.mixedPayment")}</option></select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e4ecf2] pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <select aria-label={t("common.fields.paymentMethod")} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="select-field text-xs sm:text-sm"><option value="all">{t("bookings.filters.allPaymentMethods")}</option><option value="VODAFONE_CASH">{t("enums.paymentMethod.vodafoneCash")}</option><option value="INSTAPAY">{t("enums.paymentMethod.instapay")}</option><option value="WALLET">{t("enums.paymentMethod.wallet")}</option><option value="CASH">{t("enums.paymentMethod.cash")}</option><option value="CARD">{t("enums.paymentMethod.bankCard")}</option></select>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#d8e4ec] bg-[#f8fbfd] px-3 py-1.5 text-xs sm:text-sm"><input type="checkbox" checked={hasReports} onChange={(event) => setHasReports(event.target.checked)} className="size-4" /><span className="flex items-center gap-1 font-semibold text-red-700"><AlertTriangle className="size-3.5" /> {t("bookings.filters.withReports")}</span></label>
            <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="flex items-center gap-1 text-xs font-semibold text-[#059ff8] hover:underline sm:text-sm"><Filter className="size-3.5" /> {showAdvanced ? t("bookings.filters.hideDateFilter") : t("bookings.filters.showDateFilter")}</button>
          </div>
          {hasActiveFilters ? <button type="button" onClick={resetFilters} className="flex items-center gap-1 text-xs font-medium text-[#606060] hover:text-red-700 sm:text-sm"><RotateCcw className="size-3.5" /> {t("common.actions.resetFilters")}</button> : null}
        </div>
        {showAdvanced ? <ValidationScope validation={dateValidation}><div className="grid gap-3 border-t border-[#e4ecf2] pt-3 sm:grid-cols-3"><select aria-label={t("bookings.filters.dateType")} value={dateType} onChange={(event) => setDateType(event.target.value as "created" | "departure")} className="select-field w-full"><option value="departure">{t("bookings.filters.dateTypeDeparture")}</option><option value="created">{t("bookings.filters.dateTypeCreated")}</option></select><Input fieldName="fromDate" type="date" aria-label={t("bookings.filters.fromDate")} value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="bg-white" /><Input fieldName="toDate" type="date" aria-label={t("bookings.filters.toDate")} value={toDate} onChange={(event) => setToDate(event.target.value)} className="bg-white" /></div></ValidationScope> : null}
      </div>

      {error ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {isPending && !fetchError && !invalidDates ? (
        // أول تحميل (أو مفتاح فلترة جديد بدون كاش) — هيكل الجدول بدل الوميض الفارغ
        <TableSkeleton rows={10} columns={6} />
      ) : (
        <AgGridTable<AdminBookingSummary>
          key={JSON.stringify(filterParams)}
          gridId="bookings"
          rows={items}
          nextCursor={nextCursor}
          loadMore={async () => { await bookingQuery.fetchNextPage(); }}
          loading={bookingQuery.isFetchingNextPage}
          errorMessage={error}
          getRowId={(booking) => booking.id}
          columnDefs={columns}
          emptyMessage={t("bookings.list.empty")}
        />
      )}
      {error && !items.length ? <Button variant="outline" onClick={() => void bookingQuery.refetch()}>{t("common.actions.retry")}</Button> : null}
      {selectedBookingId ? <GroupedBookingDetailsDialog bookingId={selectedBookingId} onClose={closeGroupedBooking} /> : null}

      <CreateGroupBookingDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

/**
 * `useSearchParams()` suspends during prerender and must sit under a Suspense
 * boundary — otherwise the server cannot finish the boundary and the browser
 * falls back to client rendering ("switched to client rendering"). The shell
 * layout already provides an outer boundary; this inner one keeps the fallback
 * scoped to the bookings grid instead of the whole page.
 */
export default function BookingsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={9} columns={7} />}>
      <BookingsPageInner />
    </Suspense>
  );
}
