"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Filter, Plus, RotateCcw, Ticket } from "lucide-react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BOOKING_STATUS_AR,
  deleteBooking,
  fetchAdminBookingsPage,
  PAYMENT_METHOD_AR,
  PAYMENT_STATUS_AR,
  type AdminBookingFilterParams,
  type AdminBookingListItem,
} from "@/lib/actions/bookings";
import { apiGet } from "@/lib/actions/http";
import { findTripAcrossFleets } from "@/lib/actions/trips";
import { CreateBookingDialog } from "@/components/bookings/create-booking-dialog";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { InlineBlockSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { qk, removeFromCursorList, useDataQuery, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

type FleetOption = { id: string; name: string };

export default function BookingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const [fleets, setFleets] = useState<FleetOption[]>([]);
  const [, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState("");
  // Trip scope is fully URL-driven: /bookings?tripId=X always filters to that
  // trip, including when the page is already mounted and only the param changes.
  const tripId = searchParams.get("tripId") ?? "";
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
    apiGet<{ items: FleetOption[] }>("/api/fleet-owners/fleets?limit=100").then((result) => {
      if (result.ok) setFleets(result.data.items);
    });
  }, []);

  const [tripLabel, setTripLabel] = useState<{ tripId: string; text: string } | null>(null);
  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    findTripAcrossFleets(tripId).then((result) => {
      if (cancelled) return;
      const text = result.ok
        ? `${result.data.trip.origin} ← ${result.data.trip.destination} • ${new Date(result.data.trip.departAt).toLocaleString("ar-EG")}`
        : tripId;
      setTripLabel({ tripId, text });
    });
    return () => { cancelled = true; };
  }, [tripId]);
  const activeTripLabel = tripLabel && tripLabel.tripId === tripId ? tripLabel.text : null;

  const buildFilterParams = useCallback((): AdminBookingFilterParams => {
    const params: AdminBookingFilterParams = { limit: 20 };
    if (fleetId) params.fleetId = fleetId;
    if (tripId) params.tripId = tripId;
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
  }, [fleetId, tripId, searchTerm, status, paymentStatus, paymentMethod, hasReports, dateType, fromDate, toDate]);

  const filterParams = buildFilterParams();
  const { data: pageData, isPending, error: fetchError } = useDataQuery(
    qk.adminBookingsParams(filterParams),
    async () => {
      const result = await fetchAdminBookingsPage(filterParams, null);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  );
  const items = pageData?.items ?? [];
  const nextCursor = pageData?.nextCursor ?? null;
  const error = fetchError ? fetchError.message : null;

  async function removeBooking(booking: AdminBookingListItem) {
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("bookings.list.deleteConfirm.description", { value: booking.passengerName || booking.passengerPhone }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteBooking(booking.fleetId, booking.id);
    if (!result.ok) return;
    removeFromCursorList<AdminBookingListItem>(queryClient, qk.adminBookingsParams(filterParams), booking.id);
  }

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
    if (tripId) router.replace("/bookings");
  }

  const hasActiveFilters = Boolean(searchTerm || tripId || fleetId || hasReports || fromDate || toDate) || status !== "all" || paymentStatus !== "all" || paymentMethod !== "all";
  const columns: CommunityColumnDef<AdminBookingListItem>[] = [
    { field: "passengerName", headerName: t("bookings.columns.passengerName"), filter: "agTextColumnFilter" },
    { field: "passengerPhone", headerName: t("common.fields.phone"), filter: "agTextColumnFilter" },
    { field: "fleetName", headerName: t("common.fields.fleet"), filter: "agTextColumnFilter" },
    { field: "originName", headerName: t("common.fields.origin") },
    { field: "destinationName", headerName: t("common.fields.destination") },
    { field: "seats", headerName: t("common.fields.seats"), filter: "agNumberColumnFilter" },
    { field: "status", headerName: t("common.fields.bookingStatus"), valueFormatter: (params) => BOOKING_STATUS_AR[params.value as keyof typeof BOOKING_STATUS_AR] ?? params.value },
    { field: "paymentStatus", headerName: t("common.fields.paymentStatus"), valueFormatter: (params) => PAYMENT_STATUS_AR[params.value as keyof typeof PAYMENT_STATUS_AR] ?? params.value },
    { field: "paymentMethod", headerName: t("common.fields.paymentMethod"), valueFormatter: (params) => PAYMENT_METHOD_AR[params.value as keyof typeof PAYMENT_METHOD_AR] ?? params.value },
    { field: "totalAmount", headerName: t("common.fields.total"), filter: "agNumberColumnFilter" },
    { field: "hasReports", headerName: t("bookings.columns.hasReports"), valueFormatter: (params) => params.value ? t("common.value.yes") : t("common.value.no") },
    { field: "createdAt", headerName: t("bookings.columns.createdAt"), filter: "agDateColumnFilter", valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString("ar-EG") : "—" },
];

  return (
    <div className="dashboard-page space-y-6">
      <div className="page-heading">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#d6eeff] text-[#00134c]"><Ticket className="size-5" /></span><h1 className="page-title min-w-0">{t("bookings.list.badge")}</h1></div>
          <p className="page-description">{t("bookings.list.description")}</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}><Plus className="size-4" /> {t("bookings.list.newBooking")}</Button>
      </div>

      {tripId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d6eeff] bg-[#f3f8fc] p-4 shadow-sm">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#00134c]">{t("bookings.list.tripBookingsTitle")}</p>
            <p className="text-xs text-[#606060]">{activeTripLabel ? <span dir="auto">{activeTripLabel}</span> : <InlineBlockSkeleton className="h-3.5 w-44" />}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="secondary"><Link href={`/trips/${tripId}`}>{t("bookings.list.tripDetails")}</Link></Button>
            <Button size="sm" variant="outline" onClick={() => router.replace("/bookings")}>{t("bookings.list.showAllBookings")}</Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[#d6eeff] bg-white p-4 shadow-sm space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input aria-label={t("bookings.filters.searchAria")} placeholder={t("bookings.filters.searchPlaceholder")} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="bg-white" />
          <select aria-label={t("bookings.filters.fleet")} value={fleetId} onChange={(event) => setFleetId(event.target.value)} className="select-field w-full"><option value="">{t("bookings.filters.allFleetsPrefix")}{fleets.length})</option>{fleets.map((fleet) => <option key={fleet.id} value={fleet.id}>{fleet.name}</option>)}</select>
          <select aria-label={t("common.fields.bookingStatus")} value={status} onChange={(event) => setStatus(event.target.value)} className="select-field w-full"><option value="all">{t("bookings.filters.allStatuses")}</option><option value="CONFIRMED">{t("enums.bookingStatus.confirmed")}</option><option value="CANCELLED">{t("enums.bookingStatus.cancelled")}</option><option value="COMPLETED">{t("enums.bookingStatus.completed")}</option></select>
          <select aria-label={t("common.fields.paymentStatus")} value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} className="select-field w-full"><option value="all">{t("bookings.filters.allPaymentStatuses")}</option><option value="PENDING">{t("enums.paymentStatus.pending")}</option><option value="PAID">{t("enums.paymentStatus.paid")}</option><option value="REFUNDED">{t("enums.paymentStatus.refunded")}</option><option value="FAILED">{t("enums.paymentStatus.failed")}</option></select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e4ecf2] pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <select aria-label={t("common.fields.paymentMethod")} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="select-field text-xs sm:text-sm"><option value="all">{t("bookings.filters.allPaymentMethods")}</option><option value="VODAFONE_CASH">{t("enums.paymentMethod.vodafoneCash")}</option><option value="INSTAPAY">{t("enums.paymentMethod.instapay")}</option><option value="WALLET">{t("enums.paymentMethod.wallet")}</option><option value="CASH">{t("enums.paymentMethod.cash")}</option><option value="CARD">{t("enums.paymentMethod.bankCard")}</option></select>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#d8e4ec] bg-[#f8fbfd] px-3 py-1.5 text-xs sm:text-sm"><input type="checkbox" checked={hasReports} onChange={(event) => setHasReports(event.target.checked)} className="size-4" /><span className="flex items-center gap-1 font-semibold text-red-700"><AlertTriangle className="size-3.5" /> {t("bookings.filters.withReports")}</span></label>
            <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="flex items-center gap-1 text-xs font-semibold text-[#059ff8] hover:underline sm:text-sm"><Filter className="size-3.5" /> {showAdvanced ? t("bookings.filters.hideDateFilter") : t("bookings.filters.showDateFilter")}</button>
          </div>
          {hasActiveFilters ? <button type="button" onClick={resetFilters} className="flex items-center gap-1 text-xs font-medium text-[#606060] hover:text-red-700 sm:text-sm"><RotateCcw className="size-3.5" /> {t("common.actions.resetFilters")}</button> : null}
        </div>
        {showAdvanced ? <div className="grid gap-3 border-t border-[#e4ecf2] pt-3 sm:grid-cols-3"><select aria-label={t("bookings.filters.dateType")} value={dateType} onChange={(event) => setDateType(event.target.value as "created" | "departure")} className="select-field w-full"><option value="departure">{t("bookings.filters.dateTypeDeparture")}</option><option value="created">{t("bookings.filters.dateTypeCreated")}</option></select><Input type="date" aria-label={t("bookings.filters.fromDate")} value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="bg-white" /><Input type="date" aria-label={t("bookings.filters.toDate")} value={toDate} onChange={(event) => setToDate(event.target.value)} className="bg-white" /></div> : null}
      </div>

      {error ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {isPending && !fetchError ? (
        // أول تحميل (أو مفتاح فلترة جديد بدون كاش) — هيكل الجدول بدل الوميض الفارغ
        <TableSkeleton rows={10} columns={6} />
      ) : (
        <CursorList<AdminBookingListItem>
          gridId="bookings"
          initialItems={items}
          initialCursor={nextCursor}
          loadMore={async (cursor) => {
            const result = await fetchAdminBookingsPage(filterParams, cursor);
            if (!result.ok) throw new Error(result.message);
            return result.data;
          }}
          keyOf={(booking) => booking.id}
          columnDefs={columns}
          emptyMessage={t("bookings.list.empty")}
          renderItem={(booking) => (
            <RowActionsMenu
              label={t("bookings.list.rowActions", { value: booking.passengerName || booking.passengerPhone || "" })}
              actions={[
                { label: t("common.actions.openDetails"), href: `/bookings/${booking.id}` },
                { label: t("common.actions.delete"), danger: true, onSelect: () => void removeBooking(booking) },
              ]}
            />
          )}
        />
      )}
      <CreateBookingDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
