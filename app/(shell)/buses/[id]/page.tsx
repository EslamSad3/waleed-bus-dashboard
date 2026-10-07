"use client";

import { Select } from "@/components/ui/select";

import * as schemas from "@/lib/schemas/p1";

import { schemaErrors, requiredField } from "@/lib/field-validation";

import { useFieldValidation } from "@/components/ui/field-validation";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Input } from "@/components/ui/input";
import { ImagePicker } from "@/components/ui/image-picker";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import {
  deleteBus,
  disableBus,
  discardBusImage,
  fetchBrands,
  fetchBus,
  fetchBusRatingsPage,
  fetchBusTripsPage,
  reactivateBus,
  stageBusImage,
  unassignDriver,
  updateBus,
  type Bus,
  type BusRatingRow,
  type BusTripRow,
  type VehicleBrand,
} from "@/lib/actions/buses";
import { AssignDriverDialog } from "@/components/buses/assign-driver-dialog";
import { apiGet, validateImageFile, type StagedUpload } from "@/lib/actions/http";
import type { DriverRow } from "@/lib/actions/members";
import { TRIP_STATUS_AR } from "@/lib/actions/trips";
import { useFilterStore } from "@/stores/filters";
import { Dialog } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { RatingCell } from "@/components/owners/rating-cell";
import { DriverAvatar } from "@/components/owners/driver-avatar";
import { BUS_COLORS, busColorHex } from "@/lib/colors";
import { qk, patchDetail, useApiQuery, useQueryClient } from "@/lib/queries";
import { applyMutationCache, busImpact } from "@/lib/cache/mutations";
import { DetailPageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { t as tr } from "@/lib/i18n/t";

/**
 * Bus detail. A bus no longer owns a trip line — a TRIP picks both its bus and
 * its line — so the line-assignment controls are gone and the trips tab is a
 * full, cursor-paginated history with each trip's own bus average.
 */
export default function BusDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ownerId?: string }>;
}) {
  const { id } = use(params);
  const { ownerId: scopeOwnerId } = use(searchParams);
  const router = useRouter();
  const storeOwnerId = useFilterStore((s) => s.ownerId);
  const setStoreOwnerId = useFilterStore((s) => s.setOwnerId);
  // النطاق بيجي من اللينك نفسه (?ownerId=) أو من آخر نطاق مختار.
  const ownerId = scopeOwnerId || storeOwnerId || null;
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [tab, setTab] = useState<"overview" | "trips">("overview");
  const [plate, setPlate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [color, setColor] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [brandId, setBrandId] = useState("");
  const [isAirConditioned, setIsAirConditioned] = useState(false);
  const [modelYear, setModelYear] = useState("");
  const [uploading, setUploading] = useState(false);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tripsFirst, setTripsFirst] = useState<{
    key: string;
    items: BusTripRow[];
    nextCursor: string | null;
  } | null>(null);
  const [tripsReloadKey, setTripsReloadKey] = useState(0);
  const [ratingsFirst, setRatingsFirst] = useState<{
    key: string;
    items: BusRatingRow[];
    nextCursor: string | null;
  } | null>(null);
  const [ratingsReloadKey, setRatingsReloadKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);

  const { data: bus, isLoading: busLoading, error: busError } = useApiQuery<Bus>(
    qk.bus(ownerId ?? "unknown", id),
    () => fetchBus(ownerId!, id),
    { enabled: Boolean(ownerId) },
  );
  const { data: brands, isPending: brandsPending } = useApiQuery<VehicleBrand[]>(
    qk.brands,
    () => fetchBrands(true),
  );

  function syncForm(next: Bus) {
    setPlate(next.plateNumber ?? "");
    setCapacity(String(next.capacity));
    setColor(next.color ?? "");
    setImageUrl(next.imageUrl ?? "");
    setImageFile(null);
    setBrandId(next.brandId ?? "");
    setIsAirConditioned(next.isAirConditioned ?? false);
    setModelYear(next.modelYear ? String(next.modelYear) : "");
  }

  // Render-phase sync: fill the edit form from the cached bus (no setState-in-effect)
  const [formSource, setFormSource] = useState<Bus | null>(null);
  if (bus && (bus.id !== formSource?.id || bus.updatedAt !== formSource?.updatedAt)) {
    setFormSource(bus);
    syncForm(bus);
  }

  useEffect(() => {
    if (ownerId) setStoreOwnerId(ownerId);
  }, [ownerId, setStoreOwnerId]);

  useEffect(() => {
    if (!ownerId) return;
    apiGet<{ items: DriverRow[] }>(`/api/fleet-owners/${ownerId}/drivers?limit=100`).then((r) => {
      if (r.ok) setDrivers(r.data.items.filter((d) => d.status === "ACTIVE"));
    });
  }, [ownerId]);

  useEffect(() => {
    if (tab !== "trips" || !ownerId) return;
    const key = `${ownerId}/${id}`;
    fetchBusTripsPage(ownerId, id, null).then((r) => {
      if (r.ok) setTripsFirst({ key, items: r.data.items, nextCursor: r.data.nextCursor });
      else setError(r.message);
    });
  }, [tab, ownerId, id, tripsReloadKey]);

  // The reviews live beside the trips: both are "what this bus did", and a
  // rating only makes sense against the trip it was left on.
  useEffect(() => {
    if (tab !== "trips" || !ownerId) return;
    const key = `${ownerId}/${id}/${ratingsReloadKey}`;
    let cancelled = false;
    fetchBusRatingsPage(ownerId, id, null).then((r) => {
      if (cancelled) return;
      if (r.ok) setRatingsFirst({ key, items: r.data.items, nextCursor: r.data.nextCursor });
    });
    return () => {
      cancelled = true;
    };
  }, [tab, ownerId, id, ratingsReloadKey]);

  function onImageFile(file: File | null) {
    if (!file) {
      setImageFile(null);
      return;
    }
    // الاختيار بس — الرفع الفعلي بيحصل مع الحفظ مباشر للتخزين السحابي،
    // فإلغاء التعديل ميسيبش صور يتيمة.
    const invalid = validateImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setImageFile(file);
  }

  /**
   * Page-level outcome: the persistent ERROR alert next to the control that
   * failed. Success is NOT repeated here — the action wrapper's toast is the one
   * notice for the action (two success lines for one save is noise).
   */
  function note(ok: boolean, msg: string, updated?: Bus) {
    setError(ok ? null : msg);
    setStatus(ok ? null : null);
    if (ok && updated) {
      patchDetail(queryClient, qk.bus(ownerId ?? "unknown", id), updated);
    }
  }

  const validation = useFieldValidation(() => ({ ...schemaErrors(schemas.updateBusSchema, { plateNumber: plate.trim(), color, capacity: Number(capacity), modelYear: modelYear.trim() ? Number(modelYear) : undefined, brandId: brandId || null }), plateNumber: requiredField(plate) || (plate.trim().length > 50 ? tr("validation.maxLength", { max: 50 }) : undefined), color: requiredField(color) || (color.length > 50 ? tr("validation.maxLength", { max: 50 }) : undefined) }));

  async function save() {
    if (!validation.validate()) return;
    if (!ownerId) return;
    // الصورة المختارة بتترفع الأول مباشر للتخزين السحابي — لو الرفع فشل
    // مفيش تعديل يتطبق، ولو الحفظ فشل بنمسح الصورة المرحلية.
    let staged: StagedUpload | null = null;
    let nextImageUrl = imageUrl || undefined;
    if (imageFile) {
      setUploading(true);
      const s = await stageBusImage(ownerId, imageFile);
      setUploading(false);
      if (!s.ok) {
        setError(validation.failure(s));
        return;
      }
      staged = s.data;
      nextImageUrl = staged.publicUrl;
    }
    const r = await updateBus(ownerId, id, {
      plateNumber: plate || undefined,
      color: color || undefined,
      imageUrl: nextImageUrl,
      brandId: brandId || null,
      isAirConditioned,
      modelYear: modelYear === "" ? undefined : Number(modelYear),
      capacity: capacity === "" ? undefined : Number(capacity),
    });
    if (!r.ok && staged) await discardBusImage(ownerId, staged);
    if (!r.ok) { setError(validation.failure(r)); return; }
    note(true, tr("common.toast.saved"), r.data);
    if (r.ok) {
      setImageFile(null);
      setEditOpen(false);
    }
  }

  async function remove() {
    if (!ownerId) return;
    if (
      !(await confirm({
        title: tr("common.actions.deleteConfirmTitle"),
        description: tr("buses.detail.deleteConfirm.description"),
        confirmLabel: tr("common.actions.delete"),
        destructive: true,
      }))
    ) {
      return;
    }
    const r = await deleteBus(ownerId, id);
    if (!r.ok) {
      note(false, r.message);
      return;
    }
    router.push("/buses");
    router.refresh();
  }

  async function disable() {
    if (!ownerId) return;
    const r = await disableBus(ownerId, id);
    note(r.ok, r.ok ? tr("buses.detail.toast.disabled") : r.message, r.ok ? r.data : undefined);
    // A bus taken out of service must disappear from every trip and booking
    // choice that lists available buses, or the operator can still pick it.
    applyMutationCache(queryClient, busImpact({ id, ownerId }, "update"), r);
  }

  async function reactivate() {
    if (!ownerId) return;
    const r = await reactivateBus(ownerId, id);
    note(r.ok, r.ok ? tr("buses.detail.toast.enabled") : r.message, r.ok ? r.data : undefined);
    applyMutationCache(queryClient, busImpact({ id, ownerId }, "update"), r);
  }

  const refreshDrivers = async () => {
    if (!ownerId) return;
    const refreshed = await apiGet<{ items: DriverRow[] }>(
      `/api/fleet-owners/${ownerId}/drivers?limit=100`,
    );
    if (refreshed.ok) setDrivers(refreshed.data.items.filter((driver) => driver.status === "ACTIVE" && driver.isActive));
  };

  async function unassign() {
    if (!ownerId) return;
    if (
      !(await confirm({
        title: tr("buses.detail.unassignConfirm.title"),
        description: tr("buses.detail.unassignConfirm.description"),
        confirmLabel: tr("buses.detail.unassignConfirm.confirmLabel"),
        destructive: true,
      }))
    ) {
      return;
    }
    const r = await unassignDriver(ownerId, id);
    note(r.ok, r.ok ? tr("buses.detail.toast.driverUnassigned") : r.message);
    if (r.ok) await refreshDrivers();
  }

  if (!ownerId) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="title-grad text-2xl font-extrabold">{tr("buses.detail.fallbackTitle")}</h1>
        <p className="empty-state">{tr("buses.detail.noOwnerSelected")}</p>
      </div>
    );
  }
  if (busError) return <p role="alert" className="text-sm text-red-600">{busError.message}</p>;
  if (!bus || busLoading) return <DetailPageSkeleton />;

  const currentDriver = drivers.find((driver) =>
    driver.assignments?.some(
      (assignment) => assignment.busId === id && assignment.status === "ACTIVE",
    ),
  );
  const colorPresets = BUS_COLORS;
  const storedColorHex = busColorHex(color);
  const colorMissing = color && !colorPresets.some((preset) => preset.name === color);

  const ratingColumns: CommunityColumnDef<BusRatingRow>[] = [
    {
      colId: "rating",
      headerName: tr("feedback.busFeedback"),
      cellRenderer: (params: { data: BusRatingRow }) => <RatingCell value={params.data.rating} />,
    },
    { field: "passengerName", headerName: tr("feedback.passenger"), valueGetter: (params) => params.data?.passengerName || tr("common.value.withoutName") },
    { field: "comment", headerName: tr("buses.detail.ratings.comment"), valueGetter: (params) => params.data?.comment || "—" },
    { field: "trip.line.name", headerName: tr("common.fields.tripLine"), valueGetter: (params) => params.data?.trip.line.name || "—" },
    { field: "trip.departAt", headerName: tr("common.fields.date"), valueGetter: (params) => (params.data?.trip.departAt ? new Date(params.data.trip.departAt).toLocaleString("ar-EG") : "—") },
    { field: "ratedAt", headerName: tr("feedback.ratedAt"), valueGetter: (params) => (params.data?.ratedAt ? new Date(params.data.ratedAt).toLocaleString("ar-EG") : "—") },
  ];

  const tripColumns: CommunityColumnDef<BusTripRow>[] = [
    { field: "line.name", headerName: tr("common.fields.tripLine"), valueGetter: (params) => params.data?.line.name },
    { field: "line.origin", headerName: tr("common.fields.origin"), valueGetter: (params) => params.data?.line.origin || "—" },
    { field: "line.destination", headerName: tr("common.fields.destination"), valueGetter: (params) => params.data?.line.destination || "—" },
    { field: "departAt", headerName: tr("common.fields.date"), valueGetter: (params) => new Date(params.data?.departAt ?? 0).toLocaleString("ar-EG") },
    {
      // The snapshot only exists once the trip departed, so a scheduled trip
      // would show nobody even when the bus has a driver assigned. Fall back to
      // the bus's current driver, and say which of the two this is.
      headerName: tr("common.fields.snapshottedDriver"),
      valueGetter: (params) => params.data?.driver?.name ?? currentDriver?.name ?? "",
      cellRenderer: (params: { data: BusTripRow }) => {
        const snapshot = params.data.driver;
        const fallback = currentDriver;
        const shown = snapshot ?? fallback;
        if (!shown) return <span>{tr("buses.detail.noDriver")}</span>;
        return (
          <div className="flex items-center gap-2">
            <DriverAvatar name={shown.name} picture={shown.picture} size="sm" />
            <span>
              {shown.name || tr("common.value.withoutName")}
              {snapshot ? null : (
                <span className="ms-1 text-xs text-[#606060]">{tr("buses.detail.currentDriverSuffix")}</span>
              )}
            </span>
          </div>
        );
      },
    },
    { field: "status", headerName: tr("common.fields.status"), valueFormatter: (params) => TRIP_STATUS_AR[params.value as keyof typeof TRIP_STATUS_AR] ?? String(params.value ?? "—") },
    { field: "passengerCount", headerName: tr("common.fields.passengerCount") },
    {
      headerName: tr("common.fields.busRatingAvg"),
      cellRenderer: (params: { data: BusTripRow }) => <RatingCell value={params.data.busRatingAvg} />,
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title break-words">
            {/* The plate is what an operator recognises. */}
            <span dir="ltr">{bus.plateNumber ?? "—"}</span>
          </h1>
          <p className="page-description">{tr("buses.detail.description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 max-md:w-full">
          <span
            className={
              bus.isActive
                ? "shrink-0 rounded-full bg-green-100 px-3 py-0.5 text-sm text-green-800"
                : "shrink-0 rounded-full bg-slate-200 px-3 py-0.5 text-sm text-slate-700"
            }
          >
            {bus.isActive ? tr("common.status.active") : tr("common.status.inactive")}
          </span>
          <AsyncButton type="button" variant="destructive" onClick={remove}>
            <Trash2 className="size-4" /> {tr("buses.detail.deleteBus")}
          </AsyncButton>
        </div>
      </div>

      <nav aria-label={tr("buses.detail.tabsAria")} className="flex gap-2 overflow-x-auto pb-1">
        {(["overview", "trips"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-current={tab === key ? "page" : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${tab === key ? "bg-[#059ff8] text-white" : "bg-white text-[#1a1a1a] hover:bg-[#d6eeff]"}`}
          >
            {key === "overview" ? tr("buses.detail.tabOverview") : tr("buses.detail.tabTrips")}
          </button>
        ))}
      </nav>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {status && <p role="status" className="text-sm text-green-700">{status}</p>}

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panel-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="section-title">{tr("buses.detail.sections.details")}</h2>
                {bus.imageUrl ? (
                  <button
                    type="button"
                    onClick={() => setImageOpen(true)}
                    title={tr("buses.detail.viewImage")}
                    aria-label={tr("buses.detail.viewImage")}
                    className="mb-3 block w-full cursor-zoom-in rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#059ff8]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={bus.imageUrl}
                      alt={tr("buses.detail.imageAlt", { plateNumber: bus.plateNumber ?? "—" })}
                      className="h-32 w-full rounded-xl object-cover"
                    />
                  </button>
                ) : null}
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center gap-3"><dt className="shrink-0 text-[#687886]">{tr("common.fields.plateNumber")}</dt><dd dir="ltr" className="min-w-0 flex-1 truncate font-semibold">{bus.plateNumber ?? "—"}</dd></div>
                  <div className="flex items-center gap-3"><dt className="shrink-0 text-[#687886]">{tr("common.fields.color")}</dt><dd className="flex min-w-0 flex-1 items-center gap-2 font-semibold">{bus.color ? <span className="inline-block size-4 shrink-0 rounded-full border border-[#d8e4ec]" style={{ backgroundColor: busColorHex(bus.color) ?? "#e5e7eb" }} /> : null}<span className="truncate">{bus.color ?? "—"}</span></dd></div>
                  <div className="flex items-center gap-3"><dt className="shrink-0 text-[#687886]">{tr("common.fields.brand")}</dt><dd className="min-w-0 flex-1 truncate font-semibold">{bus.brand?.name ?? "—"}</dd></div>
                  <div className="flex items-center gap-3"><dt className="shrink-0 text-[#687886]">{tr("common.fields.ac")}</dt><dd className="min-w-0 flex-1 truncate font-semibold">{bus.isAirConditioned == null ? "—" : bus.isAirConditioned ? tr("common.value.yes") : tr("common.value.no")}</dd></div>
                  <div className="flex items-center gap-3"><dt className="shrink-0 text-[#687886]">{tr("common.fields.modelYear")}</dt><dd className="min-w-0 flex-1 truncate font-semibold">{bus.modelYear ?? "—"}</dd></div>
                  <div className="flex items-center gap-3"><dt className="shrink-0 text-[#687886]">{tr("common.fields.capacity")}</dt><dd className="min-w-0 flex-1 truncate font-semibold">{bus.capacity} {tr("buses.detail.seatsUnit")}</dd></div>
                </dl>
              </div>
              <Button type="button" variant="secondary" className="max-md:w-full" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" aria-hidden="true" /> {tr("common.actions.edit")}
              </Button>
            </div>
          </div>
          <div className="panel-card p-5 sm:p-6">
            <h2 className="section-title">{tr("buses.detail.sections.statusAndDriver")}</h2>
            <div className="flex flex-col gap-3">
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm">
                <span className="block text-[#606060]">{tr("buses.detail.currentDriver")}</span>
                <strong>{currentDriver?.name ?? tr("buses.detail.noDriver")}</strong>
                {currentDriver?.phoneNumber ? (
                  <span className="ms-2 text-[#606060]" dir="ltr">{currentDriver.phoneNumber}</span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <AsyncButton type="button" variant="secondary" onClick={disable} disabled={!bus.isActive}>{tr("common.actions.disable")}</AsyncButton>
                <AsyncButton type="button" variant="secondary" onClick={reactivate} disabled={bus.isActive}>{tr("buses.detail.actions.reactivate")}</AsyncButton>
              </div>
              <Button type="button" onClick={() => setAssignOpen(true)}>
                <UserPlus className="size-4" aria-hidden="true" /> {tr("buses.detail.actions.assignDriver")}
              </Button>
              <AsyncButton type="button" variant="secondary" onClick={unassign} disabled={!currentDriver}>{tr("buses.detail.actions.unassignDriver")}</AsyncButton>
            </div>
          </div>
        </div>
      )}

      {tab === "trips" && (
        <section className="space-y-3">
          <div>
            <h2 className="section-title">{tr("buses.detail.tripsTitle")}</h2>
            <p className="page-description">{tr("buses.detail.tripsDescription")}</p>
          </div>
          {!tripsFirst || tripsFirst.key !== `${ownerId}/${id}` ? (
            <TableSkeleton rows={9} columns={tripColumns.length} />
          ) : (
            <CursorList<BusTripRow>
              gridId={`bus-trips-${id}`}
              scopeKey={ownerId ?? null}
              key={`${ownerId}/${id}`}
              initialItems={tripsFirst.items}
              initialCursor={tripsFirst.nextCursor}
              loadMore={async (cursor) => {
                const r = await fetchBusTripsPage(ownerId, id, cursor);
                if (!r.ok) throw new Error(r.message);
                return r.data;
              }}
              keyOf={(row) => row.id}
              columnDefs={tripColumns}
              emptyMessage={tr("buses.detail.tripsEmpty")}
              renderItem={(row) => (
                <Link
                  href={`/trips/${row.id}/feedback`}
                  className="text-sm font-medium text-[#059ff8] underline"
                >
                  {tr("common.actions.viewFeedback")}
                </Link>
              )}
            />
          )}

          {/* Reviews for this bus, under the trips that produced them. */}
          <div className="pt-4">
            <h2 className="section-title">{tr("buses.detail.ratings.title")}</h2>
            <p className="page-description">{tr("buses.detail.ratings.description")}</p>
          </div>
          {!ratingsFirst || ratingsFirst.key !== `${ownerId}/${id}/${ratingsReloadKey}` ? (
            <TableSkeleton rows={4} columns={ratingColumns.length} />
          ) : (
            <CursorList<BusRatingRow>
              gridId={`bus-ratings-${id}`}
              scopeKey={ownerId ?? null}
              key={`${ownerId}/${id}/${ratingsReloadKey}`}
              initialItems={ratingsFirst.items}
              initialCursor={ratingsFirst.nextCursor}
              loadMore={async (cursor) => {
                const r = await fetchBusRatingsPage(ownerId, id, cursor);
                if (!r.ok) throw new Error(r.message);
                return r.data;
              }}
              keyOf={(row) => row.id}
              columnDefs={ratingColumns}
              emptyMessage={tr("buses.detail.ratings.empty")}
            />
          )}
        </section>
      )}

      <Dialog validation={validation} open={editOpen} onOpenChange={setEditOpen} title={tr("buses.detail.editDialog.title")} description={tr("buses.detail.editDialog.description", { plateNumber: bus.plateNumber ?? "—" })} size="sm">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">{tr("common.fields.plateNumber")}</span>
            <Input fieldName="plateNumber" dir="ltr" value={plate} onChange={(e) => setPlate(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">{tr("common.fields.color")}</span>
            <Select fieldName="color" value={color} onChange={(e) => setColor(e.target.value)} className="select-field w-full">
              <option value="">{tr("buses.detail.pickColor")}</option>
              {colorPresets.map((preset) => (
                <option key={preset.name} value={preset.name}>{preset.name}</option>
              ))}
              {colorMissing ? <option value={color}>{color}</option> : null}
            </Select>
          </label>
          {color ? (
            <div className="flex items-center gap-2 text-sm text-[#5e6b78]">
              <span className="inline-block size-6 rounded-full border border-[#d8e4ec]" style={{ backgroundColor: storedColorHex ?? "transparent" }} />
              {color}
            </div>
          ) : null}
          <ImagePicker
            fieldName="imageUrl"
            label={tr("buses.detail.imageLabel")}
            file={imageFile}
            onChange={(file) => void onImageFile(file)}
            existingUrl={imageUrl}
            uploading={uploading}
            hint={tr("buses.detail.imageHint")}
          />
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">{tr("common.fields.brand")}</span>
            {brandsPending ? (
              <Skeleton className="h-[2.75rem] w-full" />
            ) : (
              <Select fieldName="brandId" value={brandId} onChange={(e) => setBrandId(e.target.value)} className="select-field w-full">
                <option value="">{tr("buses.detail.noBrand")}</option>
                {(brands ?? []).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}{brand.isActive ? "" : tr("common.status.inactiveSuffix")}</option>)}
                {bus?.brand && !(brands ?? []).some((b) => b.id === bus.brand!.id) ? (
                  <option key={bus.brand.id} value={bus.brand.id}>{bus.brand.name} {tr("buses.detail.brandInactiveSuffix")}</option>
                ) : null}
              </Select>
            )}
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-2 block font-bold text-[#334454]">{tr("common.fields.modelYear")}</span>
              <Input fieldName="modelYear" dir="ltr" inputMode="numeric" type="number" min={1980} max={2100} value={modelYear} onChange={(e) => setModelYear(e.target.value)} placeholder="2022" />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block font-bold text-[#334454]">{tr("buses.detail.capacityRange")}</span>
              <Input fieldName="capacity" dir="ltr" inputMode="numeric" type="number" min={1} max={300} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </label>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={isAirConditioned} onChange={(e) => setIsAirConditioned(e.target.checked)} className="size-4" />
            {tr("common.fields.ac")}
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="danger" onClick={() => setEditOpen(false)}>{tr("common.actions.cancel")}</Button>
            <AsyncButton type="button" variant="success" onClick={save}>{tr("common.actions.saveChanges")}</AsyncButton>
          </div>
        </div>
      </Dialog>

      <AssignDriverDialog
        open={assignOpen}
        bus={ownerId ? { id, ownerId, plateNumber: bus.plateNumber } : null}
        onClose={() => setAssignOpen(false)}
        onAssigned={() => void refreshDrivers()}
      />

      {bus.imageUrl ? (
        <Dialog
          open={imageOpen}
          onOpenChange={setImageOpen}
          title={tr("buses.detail.viewImage")}
          description={tr("buses.detail.imageAlt", { plateNumber: bus.plateNumber ?? "—" })}
          size="lg"
        >
          <div className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bus.imageUrl}
              alt={tr("buses.detail.imageAlt", { plateNumber: bus.plateNumber ?? "—" })}
              className="max-h-[75vh] w-full rounded-xl object-contain"
            />
            <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="danger" onClick={() => setImageOpen(false)}>{tr("common.actions.close")}</Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
