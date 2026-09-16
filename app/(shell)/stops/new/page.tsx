"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RouteDialog } from "@/components/ui/route-dialog";
import { createStop } from "@/lib/actions/trip-lines";

export default function NewStopPage() {
  const router = useRouter();
  const [name, setName] = useState(""); const [address, setAddress] = useState(""); const [latitude, setLatitude] = useState(""); const [longitude, setLongitude] = useState(""); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(null); if (!name.trim() || !address.trim() || latitude === "" || longitude === "") { setError("أكمل الاسم والعنوان والإحداثيات."); return; } setSaving(true); const result = await createStop({ name: name.trim(), address: address.trim(), latitude: Number(latitude), longitude: Number(longitude), isActive: true }); setSaving(false); if (!result.ok) { setError(result.message); return; } router.push(`/stops/${result.data.id}`); router.refresh(); }
  return <RouteDialog title="نقطة توقف جديدة" description="سجّل المكان مرة واحدة، ثم استخدمه في أي خط على مستوى النظام." fallbackHref="/stops" size="sm"><form className="space-y-4" onSubmit={submit}><label className="block text-sm"><span className="mb-1 block font-medium">اسم النقطة</span><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثل: ميدان رمسيس"/></label><label className="block text-sm"><span className="mb-1 block font-medium">العنوان</span><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ميدان رمسيس، القاهرة"/></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm"><span className="mb-1 block font-medium">Latitude</span><Input dir="ltr" inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="30.0626"/></label><label className="block text-sm"><span className="mb-1 block font-medium">Longitude</span><Input dir="ltr" inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="31.2467"/></label></div><p className="text-xs text-slate-500">استخدم إحداثيات المكان الفعلية حتى تظهر النقطة بدقة على الخريطة لاحقًا.</p>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<Button type="submit" disabled={saving} className="w-full">{saving ? "جاري الحفظ…" : "حفظ نقطة التوقف"}</Button></form></RouteDialog>;
}
