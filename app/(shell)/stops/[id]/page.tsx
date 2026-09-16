"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { deleteStop, fetchStop, updateStop, type Stop } from "@/lib/actions/trip-lines";

export default function StopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const router = useRouter();
  const [stop, setStop] = useState<Stop | null>(null); const [open, setOpen] = useState(false); const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(""); const [address, setAddress] = useState(""); const [latitude, setLatitude] = useState(""); const [longitude, setLongitude] = useState("");
  useEffect(() => { fetchStop(id).then((r) => { if (!r.ok) { setError(r.message); return; } setStop(r.data); setName(r.data.name); setAddress(r.data.address); setLatitude(String(r.data.latitude)); setLongitude(String(r.data.longitude)); }); }, [id]);
  async function save() { const r = await updateStop(id, { name, address, latitude: Number(latitude), longitude: Number(longitude) }); if (!r.ok) setError(r.message); else { setStop(r.data); setOpen(false); } }
  async function remove() { if (!window.confirm("هل تريد حذف نقطة التوقف؟")) return; const r = await deleteStop(id); if (!r.ok) { setError(r.message); return; } router.push("/stops"); router.refresh(); }
  if (error && !stop) return <p role="alert" className="text-sm text-red-600">{error}</p>; if (!stop) return <p className="text-sm text-slate-500">جاري التحميل…</p>;
  return <div className="dashboard-page"><div className="page-heading"><div><h1 className="page-title">{stop.name}</h1><p className="page-description">{stop.address}</p></div><Button onClick={() => setOpen(true)}>تعديل النقطة</Button></div><div className="panel-card grid gap-4 p-6 sm:grid-cols-2"><div><span className="text-sm text-slate-500">الإحداثيات</span><p dir="ltr" className="mt-1 text-lg font-semibold">{Number(stop.latitude).toFixed(6)}, {Number(stop.longitude).toFixed(6)}</p></div><div><span className="text-sm text-slate-500">الحالة</span><p className="mt-1 font-semibold">{stop.isActive ? "نشطة ويمكن استخدامها" : "موقوفة"}</p></div></div><Dialog open={open} onOpenChange={setOpen} title="تعديل نقطة التوقف" size="sm"><div className="space-y-3"><Input value={name} onChange={(e) => setName(e.target.value)}/><Input value={address} onChange={(e) => setAddress(e.target.value)}/><div className="grid grid-cols-2 gap-3"><Input dir="ltr" value={latitude} onChange={(e) => setLatitude(e.target.value)}/><Input dir="ltr" value={longitude} onChange={(e) => setLongitude(e.target.value)}/></div>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex justify-between border-t pt-4"><Button variant="destructive" onClick={remove}>حذف</Button><Button onClick={save}>حفظ</Button></div></div></Dialog></div>;
}
