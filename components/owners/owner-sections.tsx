"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CursorList } from "@/components/tables/cursor-list";
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
  removeDriver,
  MEMBER_STATUS_AR,
  type DriverPage,
  type DriverRow,
  type Member,
} from "@/lib/actions/members";
import {
  deleteOwnerTripLine,
  fetchOwnerTripLinesPage,
  lineEndpoints,
  type TripLine,
} from "@/lib/actions/trip-lines";
import { CreateTripLineDialog } from "@/components/trip-lines/create-trip-line-dialog";
import { deleteTrip, fetchSystemTripsPage, type OwnerTripRow } from "@/lib/actions/trips";
import { deleteBooking, fetchAdminBookingsPage, type AdminBookingListItem } from "@/lib/actions/bookings";
import { fetchOwnerReports, type FleetReports } from "@/lib/actions/reports";
import { deleteBus, fetchBusesPage, type Bus } from "@/lib/actions/buses";
import { t } from "@/lib/i18n/t";
import { useQueryClient } from "@/lib/queries";
import { applyMutationCache, memberImpact } from "@/lib/cache/mutations";

export type OwnerSectionKey =
  | "buses"
  // "members" is commented out: the owner user IS the company, so there is no
  // separate member list to manage from this screen. Restore the entry below to
  // bring the roster back.
  // | "members"
  | "drivers"
  | "trip-lines"
  | "trips"
  | "bookings";
// "reports" is commented out for the same reason the owner detail screen has
// no ratings: a passenger rates and reports a TRIP (its bus and its driver),
// never the company. That surface lives at /trips/{id}/feedback, so an
// owner-level aggregate duplicated it under the wrong subject.
  // | "reports";

const SECTIONS: { key: OwnerSectionKey; label: string }[] = [
  { key: "buses", label: t("common.fields.buses") },
  // { key: "members", label: t("common.fields.members") },
  { key: "drivers", label: t("common.fields.drivers") },
  { key: "trip-lines", label: t("common.fields.tripLines") },
  { key: "trips", label: t("common.fields.trips") },
  { key: "bookings", label: t("common.fields.bookings") },
  // { key: "reports", label: t("common.fields.report") },
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
      {/* {section === "members" ? <OwnerMembers ownerId={ownerId} /> : null} */}
      {section === "drivers" ? <OwnerDrivers ownerId={ownerId} /> : null}
      {section === "trip-lines" ? <OwnerTripLines ownerId={ownerId} /> : null}
      {section === "trips" ? <OwnerTrips ownerId={ownerId} /> : null}
      {section === "bookings" ? <OwnerBookings ownerId={ownerId} /> : null}
      {/* {section === "reports" ? <OwnerReports ownerId={ownerId} /> : null} */}
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

  async function submit() {
    setError(null);
    if (!userId) {
      setError(t("members.form.errors.pickUser"));
      return;
    }
    if (!roleSlug) {
      setError(t("members.form.errors.pickRole"));
      return;
    }
    setSaving(true);
    const result = await addMember(ownerId, { userId, roleSlug });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    applyMutationCache(queryClient, memberImpact(ownerId, result.data, "insert"), result);
    setUserId("");
    onAdded();
  }

  return (
    <div className="panel-card p-4 sm:p-5">
      <h3 className="section-title mb-3">{t("members.form.title")}</h3>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("members.form.user")}</span>
          <select
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
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-bold text-[#334454]">{t("members.form.role")}</span>
          <select
            className="select-field w-full"
            value={roleSlug}
            onChange={(event) => setRoleSlug(event.target.value)}
            aria-label={t("members.form.role")}
          >
            <option value="">{t("members.form.pickRole")}</option>
            {roles.map((role) => (
              <option key={role.slug} value={role.slug}>
                {role.name || role.slug}
              </option>
            ))}
          </select>
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
    </div>
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
    { field: "role.slug", headerName: t("common.fields.role"), valueGetter: (params) => params.data?.role?.slug || "—" },
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
    void fetchBusesPage(ownerId, null).then((result) => {
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
            const result = await fetchBusesPage(ownerId, cursor);
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
  const confirm = useConfirm();
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

  async function removeDriverRow(driver: DriverRow) {
    const driverUserId = driver.userId;
    if (!driverUserId) return;
    if (!(await confirm({
      title: t("common.actions.deleteConfirmTitle"),
      description: t("drivers.list.deleteConfirm.description", { label: driver.name || driver.nickname || driver.phoneNumber || t("drivers.list.rowLabel"), value: "" }),
      confirmLabel: t("common.actions.delete"),
      destructive: true,
    }))) return;
    const result = await removeDriver(ownerId, driverUserId);
    if (result.ok) reload();
  }

  const columns: CommunityColumnDef<DriverRow>[] = [
    {
      colId: "driver",
      headerName: t("common.fields.driver"),
      valueGetter: (params) => params.data?.name || t("common.value.withoutName"),
      cellRenderer: (params: { data: DriverRow }) => (
        <div className="flex items-center gap-2">
          <DriverAvatar name={params.data.name} picture={params.data.picture} size="sm" />
          <span>{params.data.name || t("common.value.withoutName")}</span>
        </div>
      ),
    },
    { field: "phoneNumber", headerName: t("common.fields.phone"), valueGetter: (params) => params.data?.phoneNumber || "—" },
    { field: "roleSlug", headerName: t("common.fields.role"), valueGetter: (params) => params.data?.roleSlug || "—" },
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
                { label: t("common.actions.openDetails"), icon: Eye, href: `/drivers/${driver.userId ?? driver.id}`, disabled: !driver.userId },
                { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void removeDriverRow(driver), disabled: !driver.userId },
              ]}
            />
          )}
        />
      ) : (
        <TableSkeleton rows={3} columns={5} />
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
  const [page, setPage] = useState<{ items: TripLine[]; nextCursor: string | null } | null>(null);
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

  async function removeLine(line: TripLine) {
    if (!(await confirm({
      title: t("common.actions.deleteConfirmTitle"),
      description: t("tripLines.deleteConfirm.description", { value: line.name }),
      confirmLabel: t("common.actions.delete"),
      destructive: true,
    }))) return;
    const result = await deleteOwnerTripLine(ownerId, line.id);
    if (result.ok) reload();
  }

  const columns: CommunityColumnDef<TripLine>[] = [
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
      field: "stops",
      headerName: t("common.fields.orderedStops"),
      valueGetter: (params) => (params.data?.stops ?? []).map((stop) => stop.station?.name).filter(Boolean).join(" ← "),
    },
  ];

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  return (
    <div className="space-y-3">
      <SectionAddButton label={t("tripLines.newLine")} onClick={() => setCreateOpen(true)} />
      {page ? (
        <CursorList<TripLine>
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
  const [page, setPage] = useState<{ items: AdminBookingListItem[]; nextCursor: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminBookingsPage({ ownerId }, null).then((result) => {
      if (cancelled) return;
      if (result.ok) setPage(result.data);
      else setError(result.message);
    });
    return () => { cancelled = true; };
  }, [ownerId, reloadToken]);

  async function removeBooking(booking: AdminBookingListItem) {
    if (!(await confirm({
      title: t("common.actions.deleteConfirmTitle"),
      description: t("bookings.list.deleteConfirm.description", { value: booking.passengerName || t("common.value.unspecified") }),
      confirmLabel: t("common.actions.delete"),
      destructive: true,
    }))) return;
    const result = await deleteBooking(ownerId, booking.id);
    if (result.ok) reload();
  }

  const columns: CommunityColumnDef<AdminBookingListItem>[] = [
    { field: "passengerName", headerName: t("common.fields.passenger") },
    { field: "originName", headerName: t("common.fields.pickup"), valueGetter: (params) => params.data?.originName || "—" },
    { field: "destinationName", headerName: t("common.fields.destination"), valueGetter: (params) => params.data?.destinationName || "—" },
    { field: "seats", headerName: t("common.fields.seats") },
    { field: "status", headerName: t("common.fields.bookingStatus") },
  ];

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  return (
    <div className="space-y-3">
      <SectionAddButton label={t("bookings.createDialog.title")} onClick={() => setCreateOpen(true)} />
      {page ? (
        <CursorList<AdminBookingListItem>
          initialItems={page.items}
          initialCursor={page.nextCursor}
          loadMore={async (cursor) => {
            const result = await fetchAdminBookingsPage({ ownerId }, cursor);
            if (!result.ok) throw new Error(result.message);
            return result.data;
          }}
          keyOf={(booking) => booking.id}
          columnDefs={columns}
          emptyMessage={t("bookings.list.empty")}
          renderItem={(booking) => (
            <RowActions
              label={t("bookings.list.rowActions", { value: booking.passengerName || t("common.value.unspecified") })}
              actions={[
                { label: t("common.actions.openDetails"), icon: Eye, href: `/bookings/${booking.id}` },
                { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void removeBooking(booking) },
              ]}
            />
          )}
        />
      ) : (
        <TableSkeleton rows={3} columns={5} />
      )}
      <CreateBookingDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={reload} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export function OwnerReports({ ownerId }: { ownerId: string }) {
  const [reports, setReports] = useState<FleetReports | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  if (token === 0) {
    setToken(1);
    void fetchOwnerReports(ownerId).then((result) => {
      if (result.ok) setReports(result.data);
      else setError(result.message);
    });
  }

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
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
      {reports.reports.length === 0 ? (
        <p className="panel-card p-4 text-sm text-[#606060]">{t("reports.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {reports.reports.map((report) => (
            <li key={report.id} className="panel-card p-4">
              <p className="text-sm">{report.note}</p>
              <p className="mt-1 text-xs text-[#606060]">
                {new Date(report.createdAt).toLocaleString("ar-EG")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
