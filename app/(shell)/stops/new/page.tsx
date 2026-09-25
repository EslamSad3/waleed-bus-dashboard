"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RouteDialog } from "@/components/ui/route-dialog";
import {
  createStop,
  fetchGovernorates,
  fetchLocalities,
  fetchMarkaz,
  type Governorate,
  type Locality,
  type Markaz,
} from "@/lib/actions/trip-lines";

function coordinatesFromLink(value: string) {
  const match = value.match(/[?&]q=([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)/)
    ?? value.match(/@([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)/)
    ?? value.match(/([-+]?\d+\.\d+),\s*([-+]?\d+\.\d+)/);
  return match ? { latitude: match[1], longitude: match[2] } : null;
}

export default function NewStopPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [governorateId, setGovernorateId] = useState("");
  const [markazes, setMarkazes] = useState<Markaz[]>([]);
  const [markazId, setMarkazId] = useState("");
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [localityId, setLocalityId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchGovernorates().then((result) => {
      if (result.ok) setGovernorates(result.data);
      else setError(result.message);
    });
  }, []);

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
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim() || !governorateId || !markazId || !localityId || !latitude || !longitude) {
      setError("أكمل اسم النقطة والمحافظة والمركز والمدينة/القرية ورابط الموقع.");
      return;
    }
    setSaving(true);
    const result = await createStop({
      name: name.trim(),
      address: address.trim() || undefined,
      latitude: Number(latitude),
      longitude: Number(longitude),
      governorateId,
      localityId,
      isActive: true,
    });
    setSaving(false);
    if (!result.ok) return setError(result.message);
    router.push("/stops");
    router.refresh();
  }

  return <RouteDialog title="نقطة توقف جديدة" description="اختر المحافظة ثم المركز ثم المدينة/القرية، والصق رابط الموقع من خرائط Google لقراءة الإحداثيات تلقائيًا." fallbackHref="/stops" size="sm">
    <form className="space-y-4" onSubmit={submit}>
      <label className="block text-sm"><span className="mb-1 block font-medium">اسم النقطة</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثل: كوبري بنها" /></label>
      <label className="block text-sm"><span className="mb-1 block font-medium">المحافظة</span><select value={governorateId} onChange={(event) => pickGovernorate(event.target.value)} className="select-field w-full"><option value="">اختر المحافظة…</option>{governorates.map((governorate) => <option key={governorate.id} value={governorate.id}>{governorate.nameAr} · {governorate.nameEn}</option>)}</select></label>
      <label className="block text-sm"><span className="mb-1 block font-medium">المركز</span><select value={markazId} onChange={(event) => pickMarkaz(event.target.value)} className="select-field w-full" disabled={!governorateId}><option value="">اختر المركز…</option>{markazes.map((markaz) => <option key={markaz.id} value={markaz.id}>{markaz.nameAr} · {markaz.nameEn}</option>)}</select></label>
      <label className="block text-sm"><span className="mb-1 block font-medium">المدينة / القرية</span><select value={localityId} onChange={(event) => setLocalityId(event.target.value)} className="select-field w-full" disabled={!markazId}><option value="">اختر المدينة أو القرية…</option>{localities.map((locality) => <option key={locality.id} value={locality.id}>{locality.type === "CITY" ? "مدينة" : "قرية"} {locality.nameAr} · {locality.nameEn}</option>)}</select></label>
      <label className="block text-sm"><span className="mb-1 block font-medium">العنوان <span className="font-normal text-slate-400">(اختياري)</span></span><Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="ميدان رمسيس، القاهرة" /></label>
      <label className="block text-sm"><span className="mb-1 block font-medium">رابط موقع Google Maps</span><Input dir="ltr" value={mapLink} onChange={(event) => readMapLink(event.target.value)} placeholder="maps.google.com/?q=29.953140,31.104898" /></label>
      {latitude && longitude && <p dir="ltr" className="rounded-xl bg-[#edf6fc] p-3 text-sm font-semibold text-[#204c6b]">{latitude}, {longitude}</p>}
      <p className="text-xs text-slate-500">لا تحتاج إلى إدخال خطوط الطول والعرض يدويًا.</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={saving || governorates.length === 0} className="w-full">{saving ? "جاري الحفظ…" : "حفظ نقطة التوقف"}</Button>
    </form>
  </RouteDialog>;
}
