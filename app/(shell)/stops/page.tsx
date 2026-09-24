"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { AgGridTable } from "@/components/tables/ag-grid-table";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteStop, fetchGovernorates, fetchLocalities, fetchMarkaz, fetchStops, updateStop, type Governorate, type Locality, type Markaz, type Stop } from "@/lib/actions/trip-lines";

function googleMapsLink(latitude: number, longitude: number) {
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

function coordinatesFromLink(value: string) {
  const match = value.match(/[?&]q=([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)/)
    ?? value.match(/@([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)/)
    ?? value.match(/([-+]?\d+\.\d+),\s*([-+]?\d+\.\d+)/);
  return match ? { latitude: match[1], longitude: match[2] } : null;
}

export default function StopsPage() {
  const [stops, setStops] = useState<Stop[] | null>(null);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [editing, setEditing] = useState<Stop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [governorateId, setGovernorateId] = useState("");
  const [markazes, setMarkazes] = useState<Markaz[]>([]);
  const [markazId, setMarkazId] = useState("");
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [localityId, setLocalityId] = useState("");

  useEffect(() => {
    fetchStops().then((result) => result.ok ? setStops(result.data) : setError(result.message));
  }, []);
  useEffect(() => {
    fetchGovernorates().then((result) => {
      if (result.ok) setGovernorates(result.data);
      else setError(result.message);
    });
  }, []);

  function openEdit(stop: Stop) {
    setEditing(stop);
    setName(stop.name);
    setAddress(stop.address ?? "");
    setLatitude(String(stop.latitude));
    setLongitude(String(stop.longitude));
    setGovernorateId(stop.governorateId);
    setMapLink(googleMapsLink(stop.latitude, stop.longitude));
    const stopMarkazId = stop.locality?.markaz?.id ?? "";
    setMarkazId(stopMarkazId);
    setLocalityId(stop.localityId ?? "");
    setMarkazes([]);
    setLocalities([]);
    if (stop.governorateId) {
      fetchMarkaz(stop.governorateId).then((result) => {
        if (result.ok) setMarkazes(result.data);
      });
    }
    if (stopMarkazId) {
      fetchLocalities(stopMarkazId).then((result) => {
        if (result.ok) setLocalities(result.data);
      });
    }
    setError(null);
  }

  function pickGovernorate(id: string) {
    setGovernorateId(id);
    setMarkazId("");
    setLocalityId("");
    setMarkazes([]);
    setLocalities([]);
    if (!id) return;
    fetchMarkaz(id).then((result) => {
      if (result.ok) setMarkazes(result.data);
      else setError(result.message);
    });
  }

  function pickMarkaz(id: string) {
    setMarkazId(id);
    setLocalityId("");
    setLocalities([]);
    if (!id) return;
    fetchLocalities(id).then((result) => {
      if (result.ok) setLocalities(result.data);
      else setError(result.message);
    });
  }

  function readMapLink(value: string) {
    setMapLink(value);
    const coordinates = coordinatesFromLink(value);
    if (!coordinates) return;
    setLatitude(coordinates.latitude);
    setLongitude(coordinates.longitude);
  }

  async function save() {
    if (!editing || !name.trim() || !governorateId || !latitude || !longitude) {
      setError("أدخل اسم النقطة والمحافظة ورابط موقع Google Maps صحيح.");
      return;
    }
    setSaving(true);
    const result = await updateStop(editing.id, {
      name: name.trim(),
      address: address.trim() || null,
      governorateId,
      localityId: localityId || null,
      latitude: Number(latitude),
      longitude: Number(longitude),
    });
    setSaving(false);
    if (!result.ok) return setError(result.message);
    setStops((items) => items?.map((stop) => stop.id === result.data.id ? result.data : stop) ?? [result.data]);
    setEditing(null);
    setError(null);
  }

  async function remove() {
    if (!editing || !window.confirm(`هل تريد حذف نقطة التوقف «${editing.name}»؟`)) return;
    const result = await deleteStop(editing.id);
    if (!result.ok) return setError(result.message);
    setStops((items) => items?.filter((stop) => stop.id !== editing.id) ?? []);
    setEditing(null);
    setError(null);
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
          <p className="page-description">كل نقاط التوقف في النظام. عدّلها مباشرةً من الجدول دون صفحة تفاصيل منفصلة.</p>
        </div>
        <Button asChild><Link href="/stops/new"><Plus className="size-4" /> نقطة توقف جديدة</Link></Button>
      </div>
      {error && !editing ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {!stops ? <p className="text-sm text-slate-500">جاري التحميل…</p> : (
        <AgGridTable<Stop>
          key={stops.map((stop) => `${stop.id}:${stop.name}:${stop.latitude}:${stop.longitude}:${stop.localityId ?? ""}`).join("|")}
          gridId="stops"
          rows={stops}
          columnDefs={columns}
          emptyMessage="لا توجد نقاط توقف بعد — ابدأ بتسجيل أول مكان."
          getRowId={(stop) => stop.id}
        />
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) { setEditing(null); setError(null); } }} title="تعديل نقطة التوقف" description="غيّر الاسم أو المحافظة، والصق رابط Google Maps لتحديث الإحداثيات تلقائيًا." size="sm">
        <div className="space-y-4">
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">اسم النقطة</span><Input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">المحافظة</span><select value={governorateId} onChange={(event) => pickGovernorate(event.target.value)} className="select-field w-full"><option value="">اختر المحافظة…</option>{governorates.map((governorate) => <option key={governorate.id} value={governorate.id}>{governorate.nameAr} · {governorate.nameEn}</option>)}</select></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">المركز</span><select value={markazId} onChange={(event) => pickMarkaz(event.target.value)} className="select-field w-full"><option value="">اختر المركز…</option>{markazes.map((markaz) => <option key={markaz.id} value={markaz.id}>{markaz.nameAr} · {markaz.nameEn}</option>)}</select></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">المدينة / القرية <span className="font-normal text-slate-400">(اختياري للنقاط القديمة)</span></span><select value={localityId} onChange={(event) => setLocalityId(event.target.value)} className="select-field w-full"><option value="">بدون مدينة/قرية…</option>{localities.map((locality) => <option key={locality.id} value={locality.id}>{locality.type === "CITY" ? "مدينة" : "قرية"} {locality.nameAr} · {locality.nameEn}</option>)}</select></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">العنوان <span className="font-normal text-slate-400">(اختياري)</span></span><Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="ميدان رمسيس، القاهرة" /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">رابط موقع Google Maps</span><Input dir="ltr" value={mapLink} onChange={(event) => readMapLink(event.target.value)} placeholder="maps.google.com/?q=29.953140,31.104898" /></label>
          {latitude && longitude ? <p dir="ltr" className="rounded-xl bg-[#edf6fc] p-3 text-sm font-semibold text-[#204c6b]">{latitude}, {longitude}</p> : null}
          <p className="text-xs text-[#687886]">لا تحتاج إلى إدخال خطوط الطول والعرض يدويًا.</p>
          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-4 sm:flex-row sm:justify-between">
            <Button type="button" variant="destructive" onClick={remove}><Trash2 className="size-4" /> حذف النقطة</Button>
            <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>إلغاء</Button><Button type="button" onClick={() => void save()} disabled={saving}>{saving ? "جاري الحفظ…" : "حفظ التعديلات"}</Button></div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
