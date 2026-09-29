"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { OwnerPicker } from "@/components/owners/owner-picker";
import { RatingCell } from "@/components/owners/rating-cell";
import { DriverAvatar } from "@/components/owners/driver-avatar";
import { TableSkeleton } from "@/components/ui/skeletons";
import {
  addMember,
  fetchMembersPage,
  fetchRoleOptions,
  type Member,
} from "@/lib/actions/members";
import { fetchOwnerTripLinesPage, lineEndpoints, type TripLine } from "@/lib/actions/trip-lines";
import { CreateTripLineDialog } from "@/components/trip-lines/create-trip-line-dialog";
import { fetchAdminBookingsPage, type AdminBookingListItem } from "@/lib/actions/bookings";
import { fetchOwnerReports, type FleetReports } from "@/lib/actions/reports";
import { fetchBusesPage, type Bus } from "@/lib/actions/buses";
import { t } from "@/lib/i18n/t";

export type OwnerSectionKey =
  | "buses"
  | "members"
  | "drivers"
  | "trip-lines"
  | "trips"
  | "bookings"
  | "reports";

const SECTIONS: { key: OwnerSectionKey; label: string }[] = [
  { key: "buses", label: t("common.fields.bus") },
  { key: "members", label: t("common.fields.members") },
  { key: "drivers", label: t("common.fields.drivers") },
  { key: "trip-lines", label: t("common.fields.tripLine") },
  { key: "trips", label: t("common.fields.trips") },
  { key: "bookings", label: t("common.fields.booking") },
  { key: "reports", label: t("common.fields.report") },
];

/**
 * Everything one owner company owns, on the owner detail screen. There is no
 * second "company" level any more — the owner user IS the company, so each
 * section reads `/fleet-owners/{ownerId}/…` directly.
 */
export function OwnerSections({ ownerId }: { ownerId: string }) {
  const [section, setSection] = useState<OwnerSectionKey>("buses");

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
      {section === "members" ? <OwnerMembers ownerId={ownerId} /> : null}
      {section === "drivers" ? <OwnerDrivers ownerId={ownerId} /> : null}
      {section === "trip-lines" ? <OwnerTripLines ownerId={ownerId} /> : null}
      {section === "trips" ? <OwnerTrips ownerId={ownerId} /> : null}
      {section === "bookings" ? <OwnerBookings ownerId={ownerId} /> : null}
      {section === "reports" ? <OwnerReports ownerId={ownerId} /> : null}
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
  const [page, setPage] = useState<{ items: Bus[]; nextCursor: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  if (token === 0) {
    setToken(1);
    void fetchBusesPage(ownerId, null).then((result) => {
      if (result.ok) setPage(result.data);
      else setError(result.message);
    });
  }

  const columns: CommunityColumnDef<Bus>[] = [
    { field: "registrationNumber", headerName: t("common.fields.registrationNumber") },
    { field: "plateNumber", headerName: t("common.fields.plateNumber") },
    { field: "capacity", headerName: t("common.fields.capacity") },
    { field: "isActive", headerName: t("common.fields.status"), valueGetter: (params) => (params.data?.isActive ? t("common.status.active") : t("common.status.inactive")) },
  ];

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!page) return <TableSkeleton rows={3} columns={4} />;
  return (
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
    />
  );
}

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

function OwnerDrivers({ ownerId }: { ownerId: string }) {
  const [rows, setRows] = useState<Array<{ id: string; userId?: string; name?: string | null; status: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  if (token === 0) {
    setToken(1);
    void fetch("/api/fleet-owners/" + ownerId + "/drivers?limit=20")
      .then((r) => r.json())
      .then((body: { data?: { items?: typeof rows } }) => setRows(body.data?.items ?? []))
      .catch(() => setError(t("common.error.unknown")));
  }

  const columns: CommunityColumnDef<(typeof rows)[number]>[] = [
    { field: "name", headerName: t("common.fields.driver"), valueGetter: (params) => params.data?.name || t("common.value.withoutName") },
    { field: "status", headerName: t("common.fields.status") },
  ];

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (token === 1 && rows.length === 0) return <TableSkeleton rows={3} columns={2} />;
  return (
    <ul className="space-y-2">
      {rows.length === 0 ? (
        <li className="panel-card p-4 text-sm text-[#606060]">{t("drivers.empty")}</li>
      ) : (
        rows.map((driver) => (
          <li key={driver.id} className="panel-card flex items-center gap-3 p-3">
            <DriverAvatar name={driver.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{driver.name || t("common.value.withoutName")}</p>
              <p className="text-xs text-[#606060]">{driver.status}</p>
            </div>
          </li>
        ))
      )}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Trip lines
// ---------------------------------------------------------------------------

function OwnerTripLines({ ownerId }: { ownerId: string }) {
  const [page, setPage] = useState<{ items: TripLine[]; nextCursor: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [token, setToken] = useState(0);
  if (token === 0) {
    setToken(1);
    void fetchOwnerTripLinesPage(ownerId, null).then((result) => {
      if (result.ok) setPage(result.data);
      else setError(result.message);
    });
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
      <div className="flex justify-end">
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> {t("tripLines.newLine")}
        </Button>
      </div>
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
            <Link
              href={`/trip-lines/${line.id}?ownerId=${ownerId}`}
              className="text-sm font-medium text-[#059ff8] underline"
            >
              {t("common.actions.openDetails")}
            </Link>
          )}
        />
      ) : (
        <TableSkeleton rows={3} columns={6} />
      )}
      <CreateTripLineDialog open={createOpen} lockedOwnerId={ownerId} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

function OwnerTrips({ ownerId }: { ownerId: string }) {
  const [lineId, setLineId] = useState("");
  const [lines, setLines] = useState<TripLine[]>([]);
  const [token, setToken] = useState(0);

  if (token === 0) {
    setToken(1);
    void fetchOwnerTripLinesPage(ownerId, null).then((result) => {
      if (result.ok) {
        setLines(result.data.items);
        setLineId(result.data.items[0]?.id ?? "");
      }
    });
  }

  if (token === 1 && lines.length === 0) {
    return <p className="panel-card p-4 text-sm text-[#606060]">{t("tripLines.empty")}</p>;
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm md:max-w-96">
        <span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.tripLine")}</span>
        <select className="select-field w-full" value={lineId} onChange={(event) => setLineId(event.target.value)}>
          {lines.map((line) => {
            const ends = lineEndpoints(line);
            return (
              <option key={line.id} value={line.id}>
                {line.name} · {ends.origin ?? "—"} ← {ends.destination ?? "—"}
              </option>
            );
          })}
        </select>
      </label>
      {lineId ? <OwnerTripsGrid ownerId={ownerId} lineId={lineId} /> : null}
    </div>
  );
}

function OwnerTripsGrid({ ownerId, lineId }: { ownerId: string; lineId: string }) {
  const [page, setPage] = useState<{ items: Array<Record<string, unknown>>; nextCursor: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  if (token === 0) {
    setToken(1);
    void fetch(
      `/api/fleet-owners/${ownerId}/trip-lines/${lineId}/trips?limit=20`,
    )
      .then((r) => r.json())
      .then((body: { data?: { items?: Array<Record<string, unknown>>; nextCursor?: string | null } }) =>
        setPage({ items: body.data?.items ?? [], nextCursor: body.data?.nextCursor ?? null }),
      )
      .catch(() => setError(t("common.error.unknown")));
  }

  type Row = { id: string; origin: string | null; destination: string | null; departAt: string; status: string; driverUserId: string | null };
  const columns: CommunityColumnDef<Row>[] = [
    { field: "origin", headerName: t("common.fields.pickup"), valueGetter: (params) => params.data?.origin || "—" },
    { field: "destination", headerName: t("common.fields.destination"), valueGetter: (params) => params.data?.destination || "—" },
    { field: "departAt", headerName: t("common.fields.date"), valueGetter: (params) => (params.data?.departAt ? new Date(params.data.departAt as string).toLocaleString("ar-EG") : "—") },
    { field: "status", headerName: t("common.fields.status") },
  ];

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!page) return <TableSkeleton rows={3} columns={4} />;
  return (
    <CursorList<Row>
      initialItems={page.items as unknown as Row[]}
      initialCursor={page.nextCursor}
      loadMore={async (cursor) => {
        const result = await fetch(
          `/api/fleet-owners/${ownerId}/trip-lines/${lineId}/trips?limit=20&cursor=${encodeURIComponent(cursor ?? "")}`,
        ).then((r) => r.json());
        return {
          items: (result?.data?.items ?? []) as Row[],
          nextCursor: (result?.data?.nextCursor ?? null) as string | null,
        };
      }}
      keyOf={(trip) => trip.id}
      columnDefs={columns}
      emptyMessage={t("trips.empty")}
    />
  );
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

function OwnerBookings({ ownerId }: { ownerId: string }) {
  const [page, setPage] = useState<{ items: AdminBookingListItem[]; nextCursor: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  if (token === 0) {
    setToken(1);
    void fetchAdminBookingsPage({ ownerId }, null).then((result) => {
      if (result.ok) setPage(result.data);
      else setError(result.message);
    });
  }

  const columns: CommunityColumnDef<AdminBookingListItem>[] = [
    { field: "passengerName", headerName: t("common.fields.passenger") },
    { field: "originName", headerName: t("common.fields.pickup"), valueGetter: (params) => params.data?.originName || "—" },
    { field: "destinationName", headerName: t("common.fields.destination"), valueGetter: (params) => params.data?.destinationName || "—" },
    { field: "seats", headerName: t("common.fields.seats") },
    { field: "status", headerName: t("common.fields.bookingStatus") },
  ];

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!page) return <TableSkeleton rows={3} columns={5} />;
  return (
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
    />
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
