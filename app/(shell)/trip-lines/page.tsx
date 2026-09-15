"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchTripLines, type TripLine } from "@/lib/actions/trip-lines";

export default function TripLinesPage() {
  const [lines, setLines] = useState<TripLine[] | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetchTripLines().then((r) => r.ok ? setLines(r.data) : setError(r.message)); }, []);
  return <div className="dashboard-page"><div className="page-heading"><div><h1 className="page-title">خطوط الرحلات</h1><p className="page-description">مسارات موحّدة لكل النظام، مبنية من نقاط التوقف المسجلة.</p></div><Button asChild><Link href="/trip-lines/new"><Plus className="size-4"/> خط رحلة جديد</Link></Button></div>{error ? <p role="alert" className="text-sm text-red-600">{error}</p> : !lines ? <p className="text-sm text-slate-500">جاري التحميل…</p> : lines.length === 0 ? <div className="panel-card p-8 text-center"><Route className="mx-auto mb-3 size-8 text-[#2f719e]"/><h2 className="section-title">لا توجد خطوط رحلة بعد</h2><p className="text-sm text-slate-500">أضف نقاط التوقف أولًا، ثم رتّبها في خط واضح للركاب والتشغيل.</p></div> : <div className="grid gap-3">{lines.map((line) => <Link key={line.id} href={`/trip-lines/${line.id}`} className="list-card"><span><strong>{line.name}</strong><span className="mt-1 block text-sm text-slate-500"><span dir="ltr">{line.code}</span> · {line.stations.length} نقاط توقف</span></span><span className="text-left"><span className="block font-semibold">{line.origin} ← {line.destination}</span><span className={line.isActive ? "status-pill mt-2" : "status-pill status-pill-muted mt-2"}>{line.isActive ? "نشط" : "موقوف"}</span></span></Link>)}</div>}</div>;
}
