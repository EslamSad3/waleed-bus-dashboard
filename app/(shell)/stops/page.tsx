"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchStops, type Stop } from "@/lib/actions/trip-lines";

export default function StopsPage() {
  const [stops, setStops] = useState<Stop[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStops(null); setError(null);
    fetchStops().then((result) => result.ok ? setStops(result.data) : setError(result.message));
  }, []);

  return <div className="dashboard-page">
    <div className="page-heading"><div><h1 className="page-title">نقاط التوقف</h1><p className="page-description">كتالوج موحّد لكل النظام، يعاد استخدامه في أي خط رحلة.</p></div><Button asChild><Link href="/stops/new"><Plus className="size-4"/> نقطة توقف جديدة</Link></Button></div>
    {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : !stops ? <p className="text-sm text-slate-500">جاري التحميل…</p> : stops.length === 0 ? <div className="panel-card p-8 text-center"><MapPin className="mx-auto mb-3 size-8 text-[#2f719e]"/><h2 className="section-title">لا توجد نقاط توقف بعد</h2><p className="text-sm text-slate-500">ابدأ بتسجيل أول مكان حتى يتاح اختياره عند بناء خط رحلة.</p></div> : <div className="grid gap-3 lg:grid-cols-2">{stops.map((stop) => <Link key={stop.id} href={`/stops/${stop.id}`} className="list-card"><span><strong>{stop.name}</strong><span className="mt-1 block text-sm text-slate-500">{stop.address}</span></span><span className="text-left text-xs text-slate-500" dir="ltr">{Number(stop.latitude).toFixed(5)}, {Number(stop.longitude).toFixed(5)}<span className={stop.isActive ? "status-pill mr-2" : "status-pill status-pill-muted mr-2"}>{stop.isActive ? "نشطة" : "موقوفة"}</span></span></Link>)}</div>}
  </div>;
}
