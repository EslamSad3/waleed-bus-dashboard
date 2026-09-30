"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Dialog } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { RowActions } from "@/components/ui/row-actions";
import { TableSkeleton } from "@/components/ui/skeletons";
import {
  createStop,
  deleteStop,
  fetchGovernorates,
  fetchLocalities,
  fetchMarkaz,
  fetchStops,
  updateStop,
  type Governorate,
  type Locality,
  type Markaz,
  type Stop,
} from "@/lib/actions/trip-lines";
import { qk, upsertInList, useApiQuery, useQueryClient } from "@/lib/queries";
import { applyMutationCache, referenceImpact } from "@/lib/cache/mutations";
import { t } from "@/lib/i18n/t";

function coordinatesFromLink(value: string) {
  const match = value.match(/[?&]q=([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)/)
    ?? value.match(/@([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)/)
    ?? value.match(/([-+]?\d+\.\d+),\s*([-+]?\d+\.\d+)/);
  return match ? { latitude: match[1], longitude: match[2] } : null;
}

/** حقول الموقع المتسلسلة (محافظة → مركز → مدينة/قرية) + رابط الخرائط — مشتركة بين الإضافة والتعديل. */
function LocationFields({
  governorates,
  governorateId,
  markazes,
  markazId,
  localities,
  localityId,
  mapLink,
  latitude,
  longitude,
  onGovernorate,
  onMarkaz,
  onLocality,
  onMapLink,
}: {
  governorates: Governorate[];
  governorateId: string;
  markazes: Markaz[];
  markazId: string;
  localities: Locality[];
  localityId: string;
  mapLink: string;
  latitude: string;
  longitude: string;
  onGovernorate: (id: string) => void;
  onMarkaz: (id: string) => void;
  onLocality: (id: string) => void;
  onMapLink: (value: string) => void;
}) {
  return (
    <>
      <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.governorate")}</span><select value={governorateId} onChange={(event) => onGovernorate(event.target.value)} className="select-field w-full"><option value="">{t("localities.dialog.pickGovernorate")}</option>{governorates.map((governorate) => <option key={governorate.id} value={governorate.id}>{governorate.nameAr} · {governorate.nameEn}</option>)}</select></label>
      <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.markaz")}</span><select value={markazId} onChange={(event) => onMarkaz(event.target.value)} className="select-field w-full" disabled={!governorateId}><option value="">{t("localities.dialog.pickMarkaz")}</option>{markazes.map((markaz) => <option key={markaz.id} value={markaz.id}>{markaz.nameAr} · {markaz.nameEn}</option>)}</select></label>
      <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("stops.dialog.localityLabel")}</span><select value={localityId} onChange={(event) => onLocality(event.target.value)} className="select-field w-full" disabled={!markazId}><option value="">{t("stops.dialog.pickLocality")}</option>{localities.map((locality) => <option key={locality.id} value={locality.id}>{locality.type === "CITY" ? t("enums.localityType.city") : t("enums.localityType.village")} {locality.nameAr} · {locality.nameEn}</option>)}</select></label>
      <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("stops.dialog.mapsUrlLabel")}</span><Input dir="ltr" value={mapLink} onChange={(event) => onMapLink(event.target.value)} placeholder="maps.google.com/?q=29.953140,31.104898" /></label>
      {latitude && longitude ? <p dir="ltr" className="rounded-xl bg-[#eaf6ff] p-3 text-sm font-semibold text-[#00134c]">{latitude}, {longitude}</p> : null}
      <p className="text-xs text-[#687886]">{t("stops.dialog.coordsHint")}</p>
    </>
  );
}

function useChain(initial?: { markazId?: string; localityId?: string }) {
  const [governorateId, setGovernorateId] = useState("");
  const [markazId, setMarkazId] = useState(initial?.markazId ?? "");
  const [localityId, setLocalityId] = useState(initial?.localityId ?? "");
  const [markazes, setMarkazes] = useState<Markaz[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);

  function pickGovernorate(id: string) {
    setGovernorateId(id);
    setMarkazId("");
    setLocalityId("");
    setMarkazes([]);
    setLocalities([]);
    if (!id) return;
    fetchMarkaz(id).then((result) => {
      if (result.ok) setMarkazes(result.data);
    });
  }

  function pickMarkaz(id: string) {
    setMarkazId(id);
    setLocalityId("");
    setLocalities([]);
    if (!id) return;
    fetchLocalities(id).then((result) => {
      if (result.ok) setLocalities(result.data);
    });
  }

  return {
    governorateId, markazId, localityId, markazes, localities,
    pickGovernorate, pickMarkaz, setGovernorateId, setMarkazId, setLocalityId, setMarkazes, setLocalities,
  };
}

function CreateStopDialog({
  open,
  governorates,
  onClose,
}: {
  open: boolean;
  governorates: Governorate[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [error, setError] = useState<string | null>(null);
  const chain = useChain();

  function readMapLink(value: string) {
    setMapLink(value);
    const coordinates = coordinatesFromLink(value);
    if (!coordinates) return;
    setLatitude(coordinates.latitude);
    setLongitude(coordinates.longitude);
    setError(null);
  }

  function resetForm() {
    setName(""); setAddress(""); setMapLink(""); setLatitude(""); setLongitude("");
    setError(null);
    chain.pickGovernorate("");
  }

  async function submit() {
    setError(null);
    if (!name.trim() || !chain.governorateId || !chain.markazId || !chain.localityId || !latitude || !longitude) {
      setError(t("stops.errors.required"));
      return;
    }
    const result = await createStop({
      name: name.trim(),
      address: address.trim() || undefined,
      latitude: Number(latitude),
      longitude: Number(longitude),
      governorateId: chain.governorateId,
      localityId: chain.localityId,
      isActive: true,
    });
    if (!result.ok) return setError(result.message);
    // A new stop must reach every trip line's stop picker, not just this table.
    applyMutationCache(queryClient, referenceImpact(result.data.id, "stops", "insert"), result);
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title={t("stops.createDialog.title")} description={t("stops.createDialog.description")} size="sm">
      <div className="space-y-4">
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("stops.dialog.nameLabel")}</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("stops.placeholders.name")} /></label>
        <LocationFields
          governorates={governorates}
          governorateId={chain.governorateId}
          markazes={chain.markazes}
          markazId={chain.markazId}
          localities={chain.localities}
          localityId={chain.localityId}
          mapLink={mapLink}
          latitude={latitude}
          longitude={longitude}
          onGovernorate={chain.pickGovernorate}
          onMarkaz={chain.pickMarkaz}
          onLocality={chain.setLocalityId}
          onMapLink={readMapLink}
        />
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.address")} <span className="font-normal text-slate-400">{t("common.value.optional")}</span></span><Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder={t("stops.placeholders.address")} /></label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>{t("common.actions.cancel")}</Button>
          <AsyncButton type="button" variant="success" onClick={submit}>{t("stops.createDialog.submit")}</AsyncButton>
        </div>
      </div>
    </Dialog>
  );
}

export default function StopsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: stops, isLoading, error } = useApiQuery<Stop[]>(qk.stops, fetchStops);
  const { data: governorates } = useApiQuery<Governorate[]>(qk.governorates, fetchGovernorates);
  const [editing, setEditing] = useState<Stop | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const chain = useChain();

  function googleMapsLink(lat: number, lng: number) {
    return `https://maps.google.com/?q=${lat},${lng}`;
  }

  function openEdit(stop: Stop) {
    setEditing(stop);
    setName(stop.name);
    setAddress(stop.address ?? "");
    setLatitude(String(stop.latitude));
    setLongitude(String(stop.longitude));
    setMapLink(googleMapsLink(stop.latitude, stop.longitude));
    chain.setGovernorateId(stop.governorateId);
    chain.setLocalityId(stop.localityId ?? "");
    setDialogError(null);
    if (stop.governorateId) {
      fetchMarkaz(stop.governorateId).then((result) => {
        if (result.ok) chain.setMarkazes(result.data);
      });
    }
    const stopMarkazId = stop.locality?.markaz?.id ?? "";
    chain.setMarkazId(stopMarkazId);
    if (stopMarkazId) {
      fetchLocalities(stopMarkazId).then((result) => {
        if (result.ok) chain.setLocalities(result.data);
      });
    }
  }

  function readMapLink(value: string) {
    setMapLink(value);
    const coordinates = coordinatesFromLink(value);
    if (!coordinates) return;
    setLatitude(coordinates.latitude);
    setLongitude(coordinates.longitude);
  }

  function closeDialog() {
    setEditing(null);
    setDialogError(null);
  }

  async function save() {
    if (!editing) return;
    if (!name.trim() || !chain.governorateId || !latitude || !longitude) {
      setDialogError(t("stops.errors.nameGovernorateMaps"));
      return;
    }
    const result = await updateStop(editing.id, {
      name: name.trim(),
      address: address.trim() || null,
      governorateId: chain.governorateId,
      localityId: chain.localityId || null,
      latitude: Number(latitude),
      longitude: Number(longitude),
    });
    if (!result.ok) return setDialogError(result.message);
    applyMutationCache(queryClient, referenceImpact(result.data.id, "stops", "update"), result);
    closeDialog();
  }

  async function removeRow(stop: Stop) {
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("stops.deleteConfirm.description", { stopName: stop.name }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteStop(stop.id);
    if (!result.ok) return setDialogError(result.message);
    applyMutationCache(queryClient, referenceImpact(stop.id, "stops", "remove"), result);
  }

  const columns: CommunityColumnDef<Stop>[] = [
    {
      field: "name",
      headerName: t("common.fields.name"),
      cellRenderer: (params: { data?: Stop }) => params.data ? <span className="font-bold">{params.data.name}<span className={params.data.isActive ? "mr-2 status-pill" : "mr-2 status-pill status-pill-muted"}>{params.data.isActive ? t("common.status.activeF") : t("common.status.inactiveF")}</span></span> : null,
    },
    { field: "latitude", headerName: t("stops.columns.latitude"), filter: "agNumberColumnFilter", valueFormatter: (params) => Number(params.value).toFixed(6) },
    { field: "longitude", headerName: t("stops.columns.longitude"), filter: "agNumberColumnFilter", valueFormatter: (params) => Number(params.value).toFixed(6) },
    { field: "governorate.nameAr", headerName: t("common.fields.governorate"), valueGetter: (params) => params.data?.governorate.nameAr },
    { headerName: t("stops.columns.locality"), valueGetter: (params) => params.data?.locality ? `${params.data.locality.nameAr} (${params.data.locality.markaz?.nameAr ?? ""})` : "—" },
    { field: "address", headerName: t("common.fields.address"), valueFormatter: (params) => params.value || "—" },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("stops.title")}</h1>
          <p className="page-description">{t("stops.description")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> {t("stops.newStop")}</Button>
      </div>
      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p> : null}
      {isLoading ? <TableSkeleton columns={7} /> : (
        <CursorList<Stop>
          gridId="stops"
          initialItems={stops ?? []}
          initialCursor={null}
          loadMore={async () => ({ items: [], nextCursor: null })}
          keyOf={(stop) => stop.id}
          columnDefs={columns}
          emptyMessage={t("stops.empty")}
          renderItem={(stop) => (
            <RowActions
              label={t("stops.list.rowActions", { stopName: stop.name })}
              actions={[
                { label: t("common.actions.edit"), icon: Pencil, onSelect: () => openEdit(stop) },
                { label: t("common.actions.delete"), icon: Trash2, tone: "danger", onSelect: () => void removeRow(stop) },
              ]}
            />
          )}
        />
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) closeDialog(); }} title={t("stops.editDialog.title")} description={t("stops.editDialog.description")} size="sm">
        <div className="space-y-4">
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("stops.dialog.nameLabel")}</span><Input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <LocationFields
            governorates={governorates ?? []}
            governorateId={chain.governorateId}
            markazes={chain.markazes}
            markazId={chain.markazId}
            localities={chain.localities}
            localityId={chain.localityId}
            mapLink={mapLink}
            latitude={latitude}
            longitude={longitude}
            onGovernorate={chain.pickGovernorate}
            onMarkaz={chain.pickMarkaz}
            onLocality={chain.setLocalityId}
            onMapLink={readMapLink}
          />
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.address")} <span className="font-normal text-slate-400">{t("common.value.optional")}</span></span><Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder={t("stops.placeholders.address")} /></label>
          {dialogError ? <p role="alert" className="text-sm text-red-600">{dialogError}</p> : null}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="danger" onClick={closeDialog}>{t("common.actions.cancel")}</Button>
            <AsyncButton type="button" variant="success" onClick={save}>{t("common.actions.saveChanges")}</AsyncButton>
          </div>
        </div>
      </Dialog>

      <CreateStopDialog open={createOpen} governorates={governorates ?? []} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
