"use client";

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
  assignDriver,
  deleteBus,
  disableBus,
  discardBusImage,
  fetchBrands,
  fetchBus,
  fetchBusTripsPage,
  reactivateBus,
  stageBusImage,
  unassignDriver,
  updateBus,
  type Bus,
  type BusTripRow,
  type VehicleBrand,
} from "@/lib/actions/buses";
import { apiGet, validateImageFile, type StagedUpload } from "@/lib/actions/http";
import type { DriverRow } from "@/lib/actions/members";
import { useFilterStore } from "@/stores/filters";
import { Dialog } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { RatingCell } from "@/components/owners/rating-cell";
import { DriverAvatar } from "@/components/owners/driver-avatar";
import { BUS_COLORS, busColorHex } from "@/lib/colors";
import { qk, patchDetail, useApiQuery, useQueryClient } from "@/lib/queries";
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
  const [driverId, setDriverId] = useState("");
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [driversLoaded, setDriversLoaded] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tripsFirst, setTripsFirst] = useState<{
    key: string;
    items: BusTripRow[];
    nextCursor: string | null;
  } | null>(null);
  const [tripsReloadKey, setTripsReloadKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

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
      setDriversLoaded(true);
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

  function note(ok: boolean, msg: string, updated?: Bus) {
    setError(ok ? null : msg);
    setStatus(ok ? msg : null);
    if (ok && updated) {
      patchDetail(queryClient, qk.bus(ownerId ?? "unknown", id), updated);
    }
  }

  async function save() {
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
        note(false, s.message);
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
    note(r.ok, r.ok ? tr("common.toast.saved") : r.message, r.ok ? r.data : undefined);
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
  }

  async function reactivate() {
    if (!ownerId) return;
    const r = await reactivateBus(ownerId, id);
    note(r.ok, r.ok ? tr("buses.detail.toast.enabled") : r.message, r.ok ? r.data : undefined);
  }

  const refreshDrivers = async () => {
    if (!ownerId) return;
    const refreshed = await apiGet<{ items: DriverRow[] }>(
      `/api/fleet-owners/${ownerId}/drivers?limit=100`,
    );
    if (refreshed.ok) setDrivers(refreshed.data.items.filter((driver) => driver.status === "ACTIVE"));
  };

  async function assign() {
    if (!ownerId || !driverId) {
      setError(tr("buses.detail.errors.pickDriver"));
      return;
    }
    const r = await assignDriver(ownerId, id, { driverUserId: driverId });
    note(r.ok, r.ok ? tr("buses.detail.toast.driverAssigned") : r.message);
    if (r.ok) {
      setAssignOpen(false);
      setDriverId("");
      await refreshDrivers();
    }
  }

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
  const eligibleDrivers = drivers;
  const colorPresets = BUS_COLORS;
  const storedColorHex = busColorHex(color);
  const colorMissing = color && !colorPresets.some((preset) => preset.name === color);

  const tripColumns: CommunityColumnDef<BusTripRow>[] = [
    { field: "line.name", headerName: tr("common.fields.tripLine"), valueGetter: (params) => params.data?.line.name },
    { field: "line.origin", headerName: tr("common.fields.origin"), valueGetter: (params) => params.data?.line.origin || "—" },
    { field: "line.destination", headerName: tr("common.fields.destination"), valueGetter: (params) => params.data?.line.destination || "—" },
    { field: "departAt", headerName: tr("common.fields.date"), valueGetter: (params) => new Date(params.data?.departAt ?? 0).toLocaleString("ar-EG") },
    {
      headerName: tr("common.fields.snapshottedDriver"),
      valueGetter: (params) => params.data?.driver?.name || "—",
      cellRenderer: (params: { data: BusTripRow }) =>
        params.data.driver ? (
          <div className="flex items-center gap-2">
            <DriverAvatar name={params.data.driver.name} picture={params.data.driver.picture} size="sm" />
            <span>{params.data.driver.name}</span>
          </div>
        ) : (
          <span>{tr("common.value.withoutName")}</span>
        ),
    },
    { field: "status", headerName: tr("common.fields.status") },
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
            <span dir="ltr">{bus.registrationNumber}</span>
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
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bus.imageUrl}
                    alt={tr("buses.detail.imageAlt", { busRegistrationNumber: bus.registrationNumber })}
                    className="mb-3 h-32 w-full rounded-xl object-cover"
                  />
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
        </section>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen} title={tr("buses.detail.editDialog.title")} description={tr("buses.detail.editDialog.description", { busRegistrationNumber: bus.registrationNumber })} size="sm">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">{tr("common.fields.plateNumber")}</span>
            <Input dir="ltr" value={plate} onChange={(e) => setPlate(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">{tr("common.fields.color")}</span>
            <select value={color} onChange={(e) => setColor(e.target.value)} className="select-field w-full">
              <option value="">{tr("buses.detail.pickColor")}</option>
              {colorPresets.map((preset) => (
                <option key={preset.name} value={preset.name}>{preset.name}</option>
              ))}
              {colorMissing ? <option value={color}>{color}</option> : null}
            </select>
          </label>
          {color ? (
            <div className="flex items-center gap-2 text-sm text-[#5e6b78]">
              <span className="inline-block size-6 rounded-full border border-[#d8e4ec]" style={{ backgroundColor: storedColorHex ?? "transparent" }} />
              {color}
            </div>
          ) : null}
          <ImagePicker
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
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="select-field w-full">
                <option value="">{tr("buses.detail.noBrand")}</option>
                {(brands ?? []).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}{brand.isActive ? "" : tr("common.status.inactiveSuffix")}</option>)}
                {bus?.brand && !(brands ?? []).some((b) => b.id === bus.brand!.id) ? (
                  <option key={bus.brand.id} value={bus.brand.id}>{bus.brand.name} {tr("buses.detail.brandInactiveSuffix")}</option>
                ) : null}
              </select>
            )}
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-2 block font-bold text-[#334454]">{tr("common.fields.modelYear")}</span>
              <Input dir="ltr" inputMode="numeric" type="number" min={1980} max={2100} value={modelYear} onChange={(e) => setModelYear(e.target.value)} placeholder="2022" />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block font-bold text-[#334454]">{tr("buses.detail.capacityRange")}</span>
              <Input dir="ltr" inputMode="numeric" type="number" min={1} max={300} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
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

      <Dialog open={assignOpen} onOpenChange={setAssignOpen} title={tr("buses.detail.assignDialog.title")} description={tr("buses.detail.assignDialog.description")} size="sm">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-[#334454]">{tr("common.fields.driver")}</span>
            {driversLoaded ? (
              <select aria-label={tr("buses.detail.pickDriver")} value={driverId} onChange={(e) => setDriverId(e.target.value)} className="select-field w-full">
                <option value="">{tr("buses.detail.pickDriverOption")}</option>
                {eligibleDrivers.map((d) => {
                  const assignment = d.assignments?.find((item) => item.status === "ACTIVE");
                  const assignedElsewhere = assignment && assignment.busId !== id;
                  return (
                    <option key={d.id} value={d.userId ?? d.id}>
                      {d.name ?? (d.userId ?? d.id).slice(0, 8)}{d.phoneNumber ? ` · ${d.phoneNumber}` : ""}{assignedElsewhere ? tr("buses.detail.assignedElsewhereSuffix", { assignmentRegistrationNumber: assignment.registrationNumber }) : ""}
                    </option>
                  );
                })}
              </select>
            ) : (
              <Skeleton className="h-[2.75rem] w-full" />
            )}
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {driversLoaded && eligibleDrivers.length === 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{tr("buses.detail.noEligibleDrivers")}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="danger" onClick={() => setAssignOpen(false)}>{tr("common.actions.cancel")}</Button>
            <AsyncButton type="button" variant="success" onClick={assign} disabled={!driverId}>{tr("common.actions.confirmAssignment")}</AsyncButton>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
