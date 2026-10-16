"use client";

import { useDriverActions } from "@/components/drivers/use-driver-actions";
import { Select } from "@/components/ui/select";

import * as schemas from "@/lib/schemas/p1";

import { schemaErrors, requiredField } from "@/lib/field-validation";

import { useFieldValidation, ValidationScope } from "@/components/ui/field-validation";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CursorList } from "@/components/tables/cursor-list";
import { presentRoleName, presentRoleSlug } from "@/lib/role-presentation";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { OwnerPicker } from "@/components/owners/owner-picker";
import { RatingCell } from "@/components/owners/rating-cell";
import { DriverAvatar } from "@/components/owners/driver-avatar";
import { RowActions } from "@/components/ui/row-actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useFilterStore } from "@/stores/filters";
import { TableSkeleton } from "@/components/ui/skeletons";
import { CreateDriverDialog } from "@/components/drivers/create-driver-dialog";
import { CreateBusDialog } from "@/components/buses/create-bus-dialog";
import { EditBusDialog } from "@/components/buses/edit-bus-dialog";
import { CreateTripDialog } from "@/components/trips/create-trip-dialog";
import { CreateBookingDialog } from "@/components/bookings/create-booking-dialog";
import {
  addMember,
  fetchMembersPage,
  fetchRoleOptions,
  fetchDriversPage,
  MEMBER_STATUS_AR,
  type DriverPage,
  type DriverRow,
  type Member,
} from "@/lib/actions/members";
import {
  deleteOwnerTripLine,
  fetchOwnerTripLinesPage,
  lineEndpoints,
  lineStopCount,
  type TripLineListItem,
} from "@/lib/actions/trip-lines";
import { CreateTripLineDialog } from "@/components/trip-lines/create-trip-line-dialog";
import { deleteTrip, fetchSystemTripsPage, type OwnerTripRow } from "@/lib/actions/trips";
import { BOOKING_STATUS_AR, deleteBooking } from "@/lib/actions/bookings";
import type { AdminBookingSummary } from "@/lib/actions/booking-summaries";
import { useBookingSummaries } from "@/lib/use-booking-summaries";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import { fetchOwnerReports } from "@/lib/actions/reports";
import { deleteBus, fetchBusesPage, type Bus } from "@/lib/actions/buses";
import {
  fetchOwnerSchedulesPage,
  deleteSchedule,
  type TripSchedule,
} from "@/lib/actions/schedules";
import { CreateScheduleDialog } from "@/components/schedules/create-schedule-dialog";
import { EditScheduleDialog } from "@/components/schedules/edit-schedule-dialog";
import {
  fetchFleetFeedbackSummary,
  fetchFleetFeedbackPage,
  type TripFeedbackRow,
} from "@/lib/actions/feedback";
import { t } from "@/lib/i18n/t";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { applyMutationCache, memberImpact } from "@/lib/cache/mutations";

export type OwnerSectionKey =
  | "buses"
  | "drivers"
  | "trip-lines"
  | "schedules"
  | "trips"
  | "bookings"
  | "feedback";

const SECTIONS: { key: OwnerSectionKey; label: string }[] = [
  { key: "buses", label: t("common.fields.buses") },
  { key: "drivers", label: t("common.fields.drivers") },
  { key: "trip-lines", label: t("common.fields.tripLines") },
  { key: "schedules", label: t("common.nav.schedules") },
  { key: "trips", label: t("common.fields.trips") },
  { key: "bookings", label: t("common.fields.bookings") },
  { key: "feedback", label: t("common.fields.feedback") },
];

/**
 * Everything one owner company owns, on the owner detail screen. There is no
 * second "company" level any more — the owner user IS the company, so each
 * section reads `/fleet-owners/{ownerId}/…` directly.
 */
export function OwnerSections({ ownerId }: { ownerId: string }) {
  const [section, setSection] = useState<OwnerSectionKey>("buses");
  const setScopedOwnerId = useFilterStore((state) => state.setOwnerId);

  // This screen IS one company, so publish it as the current scope: the detail
  // pages it links to (driver, bus, line) read the scope from the store.
  useEffect(() => {
    setScopedOwnerId(ownerId);
  }, [ownerId, setScopedOwnerId]);

  return (
    <section className="space-y-4">
      <nav aria-label={t("owners.sections.aria")} className="flex gap-2 overflow-x-auto pb-1">
        {SECTIONS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setSection(entry.key)}
            aria-current={section === entry.key ? "true" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${
              section === entry.key ? "bg-[#059ff8] text-white" : "bg-white text-[#1a1a1a] hover:bg-[#d6eeff]"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </nav>
      {section === "buses" ? <OwnerBuses ownerId={ownerId} /> : null}
      {section === "drivers" ? <OwnerDrivers ownerId={ownerId} /> : null}
      {section === "trip-lines" ? <OwnerTripLines ownerId={ownerId} /> : null}
      {section === "schedules" ? <OwnerSchedules ownerId={ownerId} /> : null}
      {section === "trips" ? <OwnerTrips ownerId={ownerId} /> : null}
      {section === "bookings" ? <OwnerBookings ownerId={ownerId} /> : null}
      {section === "feedback" ? <OwnerFeedback ownerId={ownerId} /> : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Members (+ the add-member form)
// ---------------------------------------------------------------------------

function OwnerMembers({ ownerId }: { ownerId: string }) {
  const [reloadToken, setReloadToken] = useState(0);
  return (
    <div className="space-y-4">
      <AddMemberForm ownerId={ownerId} onAdded={() => setReloadToken((n) => n + 1)} />
      <OwnerMembersGrid ownerId={ownerId} reloadToken={reloadToken} />
    </div>
  );
}

/**
 * Add a user to the company. The user and the role are both required; the
 * existing Arabic validation and duplicate-member errors are surfaced as-is.
 */
function AddMemberForm({ ownerId, onAdded }: { ownerId: string; onAdded: () => void }) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
  const [users, setUsers] = useState<{ id: string; label: string }[]>([]);
  const [roles, setRoles] = useState<{ slug: string; name: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Both option lists are read-only reuse of the platform endpoints.
  useEffect(() => {
    void (async () => {
      const [userPage, rolePage] = await Promise.all([
        fetch("/api/users?limit=100").then((r) => r.json()).catch(() => null),
        fetch("/api/roles?limit=100").then((r) => r.json()).catch(() => null),
      ]);
      const userItems = (userPage?.data?.items ?? []) as Array<{
        id: string;
        name?: string | null;
        phoneNumber?: string | null;
        email?: string | null;
      }>;
      setUsers(
        userItems.map((user) => ({
          id: user.id,
          label: user.name || user.phoneNumber || user.email || user.id,
        })),
      );
      const roleItems = (rolePage?.data?.items ?? []) as Array<{
        slug: string;
        name?: string | null;
      }>;
      setRoles(roleItems.map((role) => ({ slug: role.slug, name: role.name ?? null })));
    })();
  }, []);

  const validation = useFieldValidation(() => ({ ...schemaErrors(schemas.addMemberSchema, { userId, roleSlug }), roleSlug: requiredField(roleSlug) }));

  async function submit() {
    if (!validation.validate()) return;
    setError(null);

    setSaving(true);
    const result = await addMember(ownerId, { userId, roleSlug });
    setSaving(false);
    if (!result.ok) {
      setError(validation.failure(result));
      return;
    }
    applyMutationCache(queryClient, memberImpact(ownerId, result.data, "insert"), result);
    setUserId("");
    onAdded();
  }

  return (
    <ValidationScope validation={validation}><div className="panel-card p-4 sm:p-5">
      <h3 className="section-title mb-3">{t("members.form.title")}</h3>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("members.form.user")}</span>
          <Select fieldName="userId"
            className="select-field w-full"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            aria-label={t("members.form.user")}
          >
            <option value="">{t("members.form.pickUser")}</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("members.form.role")}</span>
          <Select fieldName="roleSlug"
            className="select-field w-full"
            value={roleSlug}
            onChange={(event) => setRoleSlug(event.target.value)}
            aria-label={t("members.form.role")}
          >
            <option value="">{t("members.form.pickRole")}</option>
            {roles.map((role) => (
              <option key={role.slug} value={role.slug}>
                {presentRoleName(role)}
              </option>
            ))}
          </Select>
        </label>
        <Button type="button" onClick={() => void submit()} loading={saving}>
          {saving ? t("common.loading.saving") : t("members.form.submit")}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div></ValidationScope>
  );
}

function OwnerMembersGrid({ ownerId, reloadToken }: { ownerId: string; reloadToken: number }) {
  const [page, setPage] = useState<{ items: Member[]; nextCursor: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [token, setToken] = useState(0);

  if (reloadToken !== token) {
    setToken(reloadToken);
    setPage(null);
    setLoaded(false);
  }

  if (!loaded && !page && !error) {
    void fetchMembersPage(ownerId, null).then((result) => {
      if (result.ok) setPage(result.data);
      else setError(result.message);
      setLoaded(true);
    });
  }

  const columns: CommunityColumnDef<Member>[] = [
    { field: "user.name", headerName: t("common.fields.fullName"), valueGetter: (params) => params.data?.user?.name || t("common.value.withoutName") },
    { field: "user.phoneNumber", headerName: t("common.fields.phone"), valueGetter: (params) => params.data?.user?.phoneNumber || "—" },
    { field: "role.slug", headerName: t("common.fields.role"), valueGetter: (params) => presentRoleSlug(params.data?.role?.slug) },
    { field: "status", headerName: t("common.fields.status"), valueGetter: (params) => params.data?.status },
  ];

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!page) return <TableSkeleton rows={3} columns={4} />;

  return (
    <CursorList<Member>
      initialItems={page.items}
      initialCursor={page.nextCursor}
      loadMore={async (cursor) => {
        const result = await fetchMembersPage(ownerId, cursor);
        if (!result.ok) throw new Error(result.message);
        return result.data;
      }}
      keyOf={(member) => member.id}
      columnDefs={columns}
      emptyMessage={t("members.empty")}
    />
  );
}

// ---------------------------------------------------------------------------
// Buses
// ---------------------------------------------------------------------------

function OwnerBuses({ ownerId }: { ownerId: string }) {
  const confirm = useConfirm();
  const [page, setPage] = useState<{ items: Bus[]; nextCursor: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busForEdit, setBusForEdit] = useState<Bus | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void fetchBusesPage(ownerId, null, { stats: true }).then((result) => {
      if (cancelled) return;
      if (result.ok) setPage(result.data);
      else setError(result.message);
    });
    return () => { cancelled = true; };
  }, [ownerId, reloadToken]);

  async function removeBus(bus: Bus) {
    if (!(await confirm({
      title: t("common.actions.deleteConfirmTitle"),
      description: t("buses.list.deleteConfirm.description", { value: bus.plateNumber ?? t("common.value.withoutName") }),
      confirmLabel: t("common.actions.delete"),
      destructive: true,
    }))) return;
    const result = await deleteBus(ownerId, bus.id);
    if (result.ok) reload();
  }

  const columns: CommunityColumnDef<Bus>[] = [
    { field: "plateNumber", headerName: t("common.fields.plateNumber"), valueFormatter: (params) => params.value ?? "—" },
    { field: "capacity", headerName: t("common.fields.capacity") },
    {
      colId: "tripCount",
      headerName: t("common.fields.tripCount"),
      valueGetter: (params) => params.data?.tripCount ?? 0,
    },
    {
      colId: "avgRating",
      headerName: t("common.fields.busRatingAvg"),
      cellRenderer: (params: { data: Bus }) => <RatingCell value={params.data.avgRating ?? null} />,
    },
    { field: "isActive", headerName: t("common.fields.status"), valueGetter: (params) => (params.data?.isActive ? t("common.status.active") : t("common.status.inactive")) },
  ];

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  return (
    <div className="space-y-3">
      <SectionAddButton label={t("buses.createDialog.title")} onClick={() => setCreateOpen(true)} />
      {page ? (
        <CursorList<Bus>
          initialItems={page.items}
          initialCursor={page.nextCursor}
          loadMore={async (cursor) => {
            const result = await fetchBusesPage(ownerId, cursor, { stats: true });
            if (!result.ok) throw new Error(result.message);
            return result.data;
          }}
          keyOf={(bus) => bus.id}
          columnDefs={columns}
          emptyMessage={t("buses.empty")}
          renderItem={(bus) => (
            <RowActions
              label={t("buses.list.rowActions", { value: bus.plateNumber ?? t("common.value.withoutName") })}
              actions={[
                { label: t("common.actions.openDetails"), icon: Eye, href: `/buses/${bus.id}?ownerId=${ownerId}` },
                { label: t("common.actions.edit"), icon: Pencil, onSelect: () => setBusForEdit(bus) },
                { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void removeBus(bus) },
              ]}
            />
          )}
        />
      ) : (
        <TableSkeleton rows={3} columns={5} />
      )}
      <CreateBusDialog open={createOpen} lockedOwnerId={ownerId} onClose={() => setCreateOpen(false)} onCreated={reload} />
      <EditBusDialog open={Boolean(busForEdit)} bus={busForEdit} onClose={() => { setBusForEdit(null); reload(); }} />
    </div>
  );
}

/** The one "add" affordance every owner tab shares. */
function SectionAddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="flex justify-end">
      <Button type="button" onClick={onClick}>
        <Plus className="size-4" /> {label}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

function OwnerDrivers({ ownerId }: { ownerId: string }) {
  const driverActions = useDriverActions();
  const [page, setPage] = useState<DriverPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void fetchDriversPage(ownerId, null).then((result) => {
      if (cancelled) return;
      if (result.ok) setPage(result.data);
      else setError(result.message);
    });
    return () => { cancelled = true; };
  }, [ownerId, reloadToken]);

  const columns: CommunityColumnDef<DriverRow>[] = [
    {
      colId: "driver",
      headerName: t("common.fields.driver"),
      valueGetter: (params) => params.data?.name || t("common.value.withoutName"),
      cellRenderer: (params: { data: DriverRow }) => (
        <div className="flex items-center gap-2">
          <DriverAvatar name={params.data.name} picture={params.data.picture} size="sm" />
          <span>{params.data.name || t("common.value.withoutName")}</span>
          {params.data.isOwnerDriver ? (
            <span className="shrink-0 rounded-full bg-[#e8f1fb] px-2 py-0.5 text-[0.7rem] font-bold text-[#1f6f8b]">
              {t("drivers.list.ownerDriverBadge")}
            </span>
          ) : null}
        </div>
      ),
    },
    { field: "phoneNumber", headerName: t("common.fields.phone"), valueGetter: (params) => params.data?.phoneNumber || "—" },
    { field: "roleSlug", headerName: t("common.fields.role"), valueGetter: (params) => presentRoleSlug(params.data?.roleSlug) },
    {
      // A driver may hold several active assignments; list every plate.
      colId: "assignedBuses",
      headerName: t("drivers.columns.assignedBus"),
      valueGetter: (params) => {
        const buses = params.data?.assignedBuses ?? [];
        const plates = buses
          .map((bus) => bus.plateNumber || bus.registrationNumber)
          .filter((plate): plate is string => Boolean(plate));
        return plates.length > 0 ? plates.join(t("common.listSeparator")) : t("drivers.list.notAssigned");
      },
    },
    {
      colId: "rating",
      headerName: t("drivers.columns.overallRating"),
      cellRenderer: (params: { data: DriverRow }) => <RatingCell value={params.data.stats?.overallRating ?? null} />,
    },
    {
      field: "status",
      headerName: t("common.fields.status"),
      filter: "agTextColumnFilter",
      valueFormatter: (params) => MEMBER_STATUS_AR[params.value as keyof typeof MEMBER_STATUS_AR] ?? params.value,
    },
  ];

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  return (
    <div className="space-y-3">
      <SectionAddButton label={t("drivers.createDialog.title")} onClick={() => setCreateOpen(true)} />
      {page ? (
        <CursorList<DriverRow>
          initialItems={page.items}
          initialCursor={page.nextCursor}
          loadMore={async (cursor) => {
            const result = await fetchDriversPage(ownerId, cursor);
            if (!result.ok) throw new Error(result.message);
            return result.data;
          }}
          keyOf={(driver) => driver.id}
          columnDefs={columns}
          emptyMessage={t("drivers.empty")}
          renderItem={(driver) => (
            <RowActions
              label={t("drivers.list.rowActions", { value: driver.name || t("common.value.withoutName") })}
              actions={[
                { label: t("common.actions.openDetails"), icon: Eye, href: `/drivers/${driver.userId ?? driver.id}?owner=${ownerId}`, disabled: !driver.userId },
                // At most three chips per row: bus assignment flows live on
                // the driver detail page. The hook returns navigation to
                // owner administration for the owner's own row instead of
                // status/delete actions.
                ...driverActions(driver, ownerId, reload, reload),
              ]}
            />
          )}
        />
      ) : (
        <TableSkeleton rows={3} columns={6} />
      )}
      <CreateDriverDialog open={createOpen} lockedOwnerId={ownerId} onCreated={reload} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trip lines
// ---------------------------------------------------------------------------

function OwnerTripLines({ ownerId }: { ownerId: string }) {
  const confirm = useConfirm();
  const [page, setPage] = useState<{ items: TripLineListItem[]; nextCursor: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void fetchOwnerTripLinesPage(ownerId, null).then((result) => {
      if (cancelled) return;
      if (result.ok) setPage(result.data);
      else setError(result.message);
    });
    return () => { cancelled = true; };
  }, [ownerId, reloadToken]);

  async function removeLine(line: TripLineListItem) {
    if (!(await confirm({
      title: t("common.actions.deleteConfirmTitle"),
      description: t("tripLines.deleteConfirm.description", { value: line.name }),
      confirmLabel: t("common.actions.delete"),
      destructive: true,
    }))) return;
    const result = await deleteOwnerTripLine(ownerId, line.id);
    if (result.ok) reload();
  }

  const columns: CommunityColumnDef<TripLineListItem>[] = [
    { field: "name", headerName: t("common.fields.tripLine") },
    { field: "code", headerName: t("common.fields.code") },
    {
      colId: "origin",
      headerName: t("common.fields.origin"),
      valueGetter: (params) => (params.data ? lineEndpoints(params.data).origin ?? "—" : "—"),
    },
    {
      colId: "destination",
      headerName: t("common.fields.destination"),
      valueGetter: (params) => (params.data ? lineEndpoints(params.data).destination ?? "—" : "—"),
    },
    { field: "qrIdentifier", headerName: t("tripLines.columns.qr") },
    {
      colId: "stopCount",
      headerName: t("tripLines.columns.stops"),
      valueGetter: (params) => params.data ? lineStopCount(params.data) : 0,
    },
  ];

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  return (
    <div className="space-y-3">
      <SectionAddButton label={t("tripLines.newLine")} onClick={() => setCreateOpen(true)} />
      {page ? (
        <CursorList<TripLineListItem>
          initialItems={page.items}
          initialCursor={page.nextCursor}
          loadMore={async (cursor) => {
            const result = await fetchOwnerTripLinesPage(ownerId, cursor);
            if (!result.ok) throw new Error(result.message);
            return result.data;
          }}
          keyOf={(line) => line.id}
          columnDefs={columns}
          emptyMessage={t("tripLines.empty")}
          renderItem={(line) => (
            <RowActions
              label={t("tripLines.list.rowActions", { value: line.name })}
              actions={[
                { label: t("common.actions.openDetails"), icon: Eye, href: `/trip-lines/${line.id}?ownerId=${ownerId}` },
                { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void removeLine(line) },
              ]}
            />
          )}
        />
      ) : (
        <TableSkeleton rows={3} columns={6} />
      )}
      <CreateTripLineDialog open={createOpen} lockedOwnerId={ownerId} onClose={() => setCreateOpen(false)} onCreated={reload} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

function OwnerTrips({ ownerId }: { ownerId: string }) {
  const confirm = useConfirm();
  const [page, setPage] = useState<{ items: OwnerTripRow[]; nextCursor: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  // Every trip this company ran, across all of its lines: the index is filtered
  // by owner instead of nesting a line picker over one line's trips.
  useEffect(() => {
    let cancelled = false;
    void fetchSystemTripsPage(null, ownerId).then((result) => {
      if (cancelled) return;
      if (result.ok) setPage(result.data);
      else setError(result.message);
    });
    return () => { cancelled = true; };
  }, [ownerId, reloadToken]);

  async function removeTrip(trip: OwnerTripRow) {
    if (!(await confirm({
      title: t("common.actions.deleteConfirmTitle"),
      description: t("trips.list.deleteConfirm.description", {
        tripOrigin: trip.origin || t("common.value.unspecified"),
        tripDestination: trip.destination || t("common.value.unspecified"),
      }),
      confirmLabel: t("common.actions.delete"),
      destructive: true,
    }))) return;
    const result = await deleteTrip(ownerId, trip.lineId, trip.id);
    if (result.ok) reload();
  }

  const columns: CommunityColumnDef<OwnerTripRow>[] = [
    {
      colId: "line",
      headerName: t("common.fields.tripLine"),
      valueGetter: (params) => params.data?.line?.name || "—",
    },
    { field: "origin", headerName: t("common.fields.pickup"), valueGetter: (params) => params.data?.origin || "—" },
    { field: "destination", headerName: t("common.fields.destination"), valueGetter: (params) => params.data?.destination || "—" },
    { field: "departAt", headerName: t("common.fields.date"), valueGetter: (params) => (params.data?.departAt ? new Date(params.data.departAt).toLocaleString("ar-EG") : "—") },
    { field: "status", headerName: t("common.fields.status") },
  ];

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  return (
    <div className="space-y-3">
      <SectionAddButton label={t("trips.createDialog.title")} onClick={() => setCreateOpen(true)} />
      {page ? (
        <CursorList<OwnerTripRow>
          initialItems={page.items}
          initialCursor={page.nextCursor}
          loadMore={async (cursor) => {
            const result = await fetchSystemTripsPage(cursor, ownerId);
            if (!result.ok) throw new Error(result.message);
            return result.data;
          }}
          keyOf={(trip) => trip.id}
          columnDefs={columns}
          emptyMessage={t("trips.empty")}
          renderItem={(trip) => (
            <RowActions
              label={t("trips.list.rowActions", {
                tripOrigin: trip.origin || t("common.value.unspecified"),
                tripDestination: trip.destination || t("common.value.unspecified"),
              })}
              actions={[
                { label: t("common.actions.openDetails"), icon: Eye, href: `/trips/${trip.id}?ownerId=${ownerId}&lineId=${trip.lineId}` },
                { label: t("common.actions.viewFeedback"), icon: Pencil, href: `/trips/${trip.id}/feedback?ownerId=${ownerId}&lineId=${trip.lineId}` },
                { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void removeTrip(trip) },
              ]}
            />
          )}
        />
      ) : (
        <TableSkeleton rows={3} columns={5} />
      )}
      <CreateTripDialog open={createOpen} lockedOwnerId={ownerId} onClose={() => setCreateOpen(false)} onCreated={reload} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

function OwnerBookings({ ownerId }: { ownerId: string }) {
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const query = useBookingSummaries({ ownerId, limit: 20 });
  async function removeBooking(booking: AdminBookingSummary) {
    if (booking.orderId) return;
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"),
      description: t("bookings.list.deleteConfirm.description", { value: booking.passengerName }),
      confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteBooking(ownerId, booking.id);
    if (result.ok) void query.refetch();
  }
  const columns: CommunityColumnDef<AdminBookingSummary>[] = [
    { field: "passengerName", headerName: t("bookings.columns.passengers"), minWidth: 220, wrapText: true, autoHeight: true },
    { field: "originName", headerName: t("common.fields.pickup") },
    { field: "destinationName", headerName: t("common.fields.destination") },
    { field: "seats", headerName: t("common.fields.seats") },
    { field: "totalAmount", headerName: t("common.fields.total") },
    { field: "status", headerName: t("common.fields.bookingStatus"), valueFormatter: ({ value }) => value === "PARTIALLY_CANCELLED"
      ? t("bookings.detail.orderSection.status.PARTIALLY_CANCELLED") : BOOKING_STATUS_AR[value] ?? value },
    { colId: "actions", headerName: t("cursorList.actionsColumn"), pinned: "left", width: 300,
      sortable: false, filter: false, exportable: false,
      cellRenderer: ({ data }: { data: AdminBookingSummary }) => <RowActions
        label={t("bookings.list.rowActions", { value: data.passengerName })}
        actions={[{ label: t("common.actions.openDetails"), icon: Eye,
          href: data.orderId ? `/bookings?bookingId=${data.orderId}` : `/bookings/${data.id}` },
          ...(!data.orderId ? [{ label: t("common.actions.delete"), icon: Trash2, tone: "danger" as const,
            onSelect: () => void removeBooking(data) }] : [])]} />,
    },
  ];
  return (
    <div className="space-y-3">
      <SectionAddButton label={t("bookings.createDialog.title")} onClick={() => setCreateOpen(true)} />
      {query.isPending ? <TableSkeleton rows={3} columns={5} /> : <AgGridTable<AdminBookingSummary>
        gridId="owner-bookings" rows={query.items} columnDefs={columns}
        getRowId={(row) => row.id} nextCursor={query.nextCursor}
        loadMore={async () => { await query.fetchNextPage(); }} loading={query.isFetchingNextPage}
        errorMessage={query.error?.message} emptyMessage={t("bookings.list.empty")} />}
      {query.error && !query.items.length ? <Button variant="outline" onClick={() => void query.refetch()}>{t("common.actions.retry")}</Button> : null}
      <CreateBookingDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { void query.refetch(); }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export function OwnerReports({ ownerId }: { ownerId: string }) {
  const { data: reports, error } = useApiQuery(qk.ownerReports(ownerId), () => fetchOwnerReports(ownerId));
  if (error) return <p role="alert" className="text-sm text-red-600">{error.message}</p>;
  if (!reports) return <TableSkeleton rows={3} columns={2} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="panel-card p-4">
          <p className="text-sm text-[#606060]">{t("reports.averageBusRating")}</p>
          <RatingCell value={reports.ratingSummary.busAvg} />
        </div>
        <div className="panel-card p-4">
          <p className="text-sm text-[#606060]">{t("reports.averageDriverRating")}</p>
          <RatingCell value={reports.ratingSummary.driverAvg} />
        </div>
      </div>
      <CursorList
        gridId="owner-reports"
        scopeKey={ownerId}
        initialItems={reports.reports.items}
        initialCursor={reports.reports.nextCursor}
        loadMore={async (cursor) => {
          const result = await fetchOwnerReports(ownerId, cursor);
          if (!result.ok) throw new Error(result.message);
          return result.data.reports;
        }}
        keyOf={(report) => report.id}
        withActions={false}
        columnDefs={[
          { field: 'note', headerName: t("reports.note") },
          { field: 'createdAt', headerName: t("reports.createdAt"), valueFormatter: ({ value }) => new Date(value).toLocaleString('ar-EG') },
        ]}
        emptyMessage={t("reports.empty")}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

function OwnerSchedules({ ownerId }: { ownerId: string }) {
  const confirm = useConfirm();
  const [page, setPage] = useState<{ items: TripSchedule[]; nextCursor: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<TripSchedule | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void fetchOwnerSchedulesPage(ownerId, null).then((result) => {
      if (cancelled) return;
      if (result.ok) setPage(result.data);
      else setError(result.message);
    });
    return () => { cancelled = true; };
  }, [ownerId, reloadToken]);

  async function removeSchedule(s: TripSchedule) {
    if (!(await confirm({
      title: t("schedules.deleteDialog.title"),
      description: t("schedules.deleteDialog.description"),
      confirmLabel: t("schedules.deleteDialog.confirm"),
      destructive: true,
    }))) return;
    const result = await deleteSchedule(ownerId, s.lineId, s.id);
    if (result.ok) reload();
  }

  const columns: CommunityColumnDef<TripSchedule>[] = [
    { field: "line.name", headerName: t("schedules.columns.line"), valueGetter: (p) => p.data?.line.name ?? "—" },
    { field: "departTime", headerName: t("schedules.columns.departureTime") },
    {
      colId: "daysOfWeek",
      headerName: t("schedules.columns.daysOfWeek"),
      cellRenderer: (params: { data: TripSchedule }) => {
        const days = params.data?.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6];
        return (
          <div className="flex flex-wrap gap-1">
            {days.map((d) => (
              <span key={d} className="rounded bg-sky-50 px-1 text-[11px] font-semibold text-sky-800">
                {t(`schedules.daysShort.${d}` as any)}
              </span>
            ))}
          </div>
        );
      },
    },
    { field: "bus.plateNumber", headerName: t("schedules.columns.bus"), valueGetter: (p) => p.data?.bus.plateNumber ?? t("common.value.withoutName") },
    { field: "driver.name", headerName: t("schedules.columns.driver"), valueGetter: (p) => p.data?.driver?.name ?? t("common.value.unassigned") },
    {
      field: "isActive",
      headerName: t("schedules.columns.status"),
      valueGetter: (p) => (p.data?.isActive ? t("common.status.active") : t("common.status.inactive")),
    },
  ];

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  return (
    <div className="space-y-3">
      <SectionAddButton label={t("schedules.createButton")} onClick={() => setCreateOpen(true)} />
      {page ? (
        <CursorList<TripSchedule>
          initialItems={page.items}
          initialCursor={page.nextCursor}
          loadMore={async (cursor) => {
            const result = await fetchOwnerSchedulesPage(ownerId, cursor);
            if (!result.ok) throw new Error(result.message);
            return result.data;
          }}
          keyOf={(s) => s.id}
          columnDefs={columns}
          emptyMessage={t("schedules.empty")}
          renderItem={(s) => (
            <RowActions
              label={s.line.name}
              actions={[
                { label: t("common.actions.edit"), icon: Pencil, onSelect: () => setEditingSchedule(s) },
                { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void removeSchedule(s) },
              ]}
            />
          )}
        />
      ) : (
        <TableSkeleton rows={3} columns={6} />
      )}
      <CreateScheduleDialog open={createOpen} lockedOwnerId={ownerId} onClose={() => setCreateOpen(false)} onCreated={reload} />
      {editingSchedule && (
        <EditScheduleDialog
          schedule={editingSchedule}
          open={Boolean(editingSchedule)}
          onClose={() => setEditingSchedule(null)}
          onUpdated={reload}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feedback (Summary + Feed)
// ---------------------------------------------------------------------------

function OwnerFeedback({ ownerId }: { ownerId: string }) {
  const { data: summary } = useApiQuery(
    qk.ownerFeedbackSummary(ownerId),
    () => fetchFleetFeedbackSummary(ownerId),
  );
  const [page, setPage] = useState<{ items: TripFeedbackRow[]; nextCursor: string | null } | null>(null);
  const [loadingFeed, setLoadingFeed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchFleetFeedbackPage(ownerId, null).then((res) => {
      if (cancelled) return;
      setLoadingFeed(false);
      if (res.ok) setPage(res.data);
    });
    return () => { cancelled = true; };
  }, [ownerId]);

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-500">{t("common.fields.avgBusRating")}</p>
            <div className="mt-2 flex items-center gap-3">
              <RatingCell value={summary.busRating.average} />
              <span className="text-xs text-slate-400">({t("common.rating.votes", { count: summary.busRating.count })})</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-500">{t("common.fields.driverRating")}</p>
            <div className="mt-2 flex items-center gap-3">
              <RatingCell value={summary.driverRating.average} />
              <span className="text-xs text-slate-400">({t("common.rating.votes", { count: summary.driverRating.count })})</span>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-700">{t("owners.feedback.feedTitle")}</h3>
        {loadingFeed ? (
          <TableSkeleton rows={4} columns={4} />
        ) : !page || page.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            {t("common.rating.unrated")}
          </div>
        ) : (
          <div className="space-y-3">
            {page.items.map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs">
                  <div className="font-semibold text-slate-800">
                    {row.passenger.name} · {row.trip.line.name}
                  </div>
                  <div className="text-slate-400">
                    {new Date(row.trip.departAt).toLocaleDateString("ar-EG")}
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
                  <div>
                    <span className="text-slate-500">{t("common.fields.busRating")}: </span>
                    <RatingCell value={row.busFeedback.rating} />
                    {row.busFeedback.comment && (
                      <p className="mt-1 text-slate-600 bg-slate-50 p-2 rounded-lg">{row.busFeedback.comment}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500">{t("common.fields.driverRating")}: </span>
                    <RatingCell value={row.driverFeedback.rating} />
                    {row.driverFeedback.comment && (
                      <p className="mt-1 text-slate-600 bg-slate-50 p-2 rounded-lg">{row.driverFeedback.comment}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

