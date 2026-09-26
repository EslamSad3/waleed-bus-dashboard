"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { qk, upsertInList, removeFromList, useApiQuery, useQueryClient } from "@/lib/queries";

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
      <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">المحافظة</span><select value={governorateId} onChange={(event) => onGovernorate(event.target.value)} className="select-field w-full"><option value="">اختار المحافظة…</option>{governorates.map((governorate) => <option key={governorate.id} value={governorate.id}>{governorate.nameAr} · {governorate.nameEn}</option>)}</select></label>
      <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">المركز</span><select value={markazId} onChange={(event) => onMarkaz(event.target.value)} className="select-field w-full" disabled={!governorateId}><option value="">اختار المركز…</option>{markazes.map((markaz) => <option key={markaz.id} value={markaz.id}>{markaz.nameAr} · {markaz.nameEn}</option>)}</select></label>
      <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">المدينة / القرية</span><select value={localityId} onChange={(event) => onLocality(event.target.value)} className="select-field w-full" disabled={!markazId}><option value="">اختار المدينة أو القرية…</option>{localities.map((locality) => <option key={locality.id} value={locality.id}>{locality.type === "CITY" ? "مدينة" : "قرية"} {locality.nameAr} · {locality.nameEn}</option>)}</select></label>
      <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">رابط موقع Google Maps</span><Input dir="ltr" value={mapLink} onChange={(event) => onMapLink(event.target.value)} placeholder="maps.google.com/?q=29.953140,31.104898" /></label>
      {latitude && longitude ? <p dir="ltr" className="rounded-xl bg-[#eaf6ff] p-3 text-sm font-semibold text-[#00134c]">{latitude}, {longitude}</p> : null}
      <p className="text-xs text-[#687886]">لا تحتاج إلى إدخال خطوط الطول والعرض يدويًا.</p>
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
  const [saving, setSaving] = useState(false);
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
      setError("أكمل اسم النقطة والمحافظة والمركز والمدينة/القرية ورابط الموقع.");
      return;
    }
    setSaving(true);
    const result = await createStop({
      name: name.trim(),
      address: address.trim() || undefined,
      latitude: Number(latitude),
      longitude: Number(longitude),
      governorateId: chain.governorateId,
      localityId: chain.localityId,
      isActive: true,
    });
    setSaving(false);
    if (!result.ok) return setError(result.message);
    upsertInList(queryClient, qk.stops, result.data);
    resetForm();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { resetForm(); onClose(); } }} title="نقطة توقف جديدة" description="اختار المحافظة ثم المركز ثم المدينة/القرية، والصق رابط الموقع من خرائط Google لقراءة الإحداثيات تلقائيًا." size="sm">
      <div className="space-y-4">
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">اسم النقطة</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثل: كوبري بنها" /></label>
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
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">العنوان <span className="font-normal text-slate-400">(اختياري)</span></span><Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="ميدان رمسيس، القاهرة" /></label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 border-t border-[#e4ecf2] pt-4">
          <Button type="button" variant="danger" onClick={() => { resetForm(); onClose(); }}>إلغاء</Button>
          <Button type="button" variant="success" onClick={() => void submit()} disabled={saving}>{saving ? "جاري الحفظ…" : "حفظ نقطة التوقف"}</Button>
        </div>
      </div>
    </Dialog>
  );
}

export default function StopsPage() {
  const queryClient = useQueryClient();
  const { data: stops, isLoading, error } = useApiQuery<Stop[]>(qk.stops, fetchStops);
  const { data: governorates } = useApiQuery<Governorate[]>(qk.governorates, fetchGovernorates);
  const [editing, setEditing] = useState<Stop | null>(null);
  const [saving, setSaving] = useState(false);
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
      setDialogError("أدخل اسم النقطة والمحافظة ورابط موقع Google Maps صحيح.");
      return;
    }
    setSaving(true);
    const result = await updateStop(editing.id, {
      name: name.trim(),
      address: address.trim() || null,
      governorateId: chain.governorateId,
      localityId: chain.localityId || null,
      latitude: Number(latitude),
      longitude: Number(longitude),
    });
    setSaving(false);
    if (!result.ok) return setDialogError(result.message);
    upsertInList(queryClient, qk.stops, result.data);
    closeDialog();
  }

  async function remove() {
    if (!editing || !window.confirm(`هل تريد حذف نقطة التوقف «${editing.name}»؟`)) return;
    const result = await deleteStop(editing.id);
    if (!result.ok) return setDialogError(result.message);
    removeFromList(queryClient, qk.stops, editing.id);
    closeDialog();
  }

  const columns: CommunityColumnDef<Stop>[] = [
    {
      field: "name",
      headerName: "الاسم",
      cellRenderer: (params: { data?: Stop }) => params.data ? <span className="font-bold">{params.data.name}<span className={params.data.isActive ? "mr-2 status-pill" : "mr-2 status-pill status-pill-muted"}>{params.data.isActive ? "نشطة" : "موقوفة"}</span></span> : null,
    },
    { field: "latitude", headerName: "خط العرض", filter: "agNumberColumnFilter", valueFormatter: (params) => Number(params.value).toFixed(6) },
    { field: "longitude", headerName: "خط الطول", filter: "agNumberColumnFilter", valueFormatter: (params) => Number(params.value).toFixed(6) },
    { field: "governorate.nameAr", headerName: "المحافظة", valueGetter: (params) => params.data?.governorate.nameAr },
    { headerName: "المدينة / القرية", valueGetter: (params) => params.data?.locality ? `${params.data.locality.nameAr} (${params.data.locality.markaz?.nameAr ?? ""})` : "—" },
    { field: "address", headerName: "العنوان", valueFormatter: (params) => params.value || "—" },
    {
      headerName: "إجراء",
      filter: false,
      sortable: false,
      exportable: false,
      cellRenderer: (params: { data?: Stop }) => {
        const stop = params.data;
        return stop ? <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(stop)}><Pencil className="size-4" /> تعديل</Button> : null;
      },
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">نقاط التوقف</h1>
          <p className="page-description">كل نقاط التوقف في النظام. الإضافة والتعديل بيتموا في نافذة من غير صفحات منفصلة.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> نقطة توقف جديدة</Button>
      </div>
      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</p> : null}
      {isLoading ? <p className="text-sm text-slate-500">جاري التحميل…</p> : (
        <AgGridTable<Stop>
          gridId="stops"
          rows={stops ?? []}
          columnDefs={columns}
          emptyMessage="لا توجد نقاط توقف بعد — ابدأ بتسجيل أول مكان."
          getRowId={(stop) => stop.id}
        />
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) closeDialog(); }} title="تعديل نقطة التوقف" description="غيّر الاسم أو المحافظة، والصق رابط Google Maps لتحديث الإحداثيات تلقائيًا." size="sm">
        <div className="space-y-4">
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">اسم النقطة</span><Input value={name} onChange={(event) => setName(event.target.value)} /></label>
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
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">العنوان <span className="font-normal text-slate-400">(اختياري)</span></span><Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="ميدان رمسيس، القاهرة" /></label>
          {dialogError ? <p role="alert" className="text-sm text-red-600">{dialogError}</p> : null}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-between">
            <Button type="button" variant="destructive" onClick={remove}><Trash2 className="size-4" /> حذف النقطة</Button>
            <div className="flex gap-2">
              <Button type="button" variant="danger" onClick={closeDialog}>إلغاء</Button>
              <Button type="button" variant="success" onClick={() => void save()} disabled={saving}>{saving ? "جاري الحفظ…" : "حفظ التعديلات"}</Button>
            </div>
          </div>
        </div>
      </Dialog>

      <CreateStopDialog open={createOpen} governorates={governorates ?? []} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
