"use client";

import { use, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fetchStops, deleteTripLine, fetchTripLine, updateTripLine, updateTripLineDirectionStops, type Stop, type TripLine, type TripLineStop } from "@/lib/actions/trip-lines";

export default function TripLineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [line, setLine] = useState<TripLine | null>(null);
  const [available, setAvailable] = useState<Stop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editMeta, setEditMeta] = useState(false);
  const [editingDirectionId, setEditingDirectionId] = useState<string | null>(null);
  const [editStops, setEditStops] = useState<Stop[]>([]);
  const [pick, setPick] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetchTripLine(id).then((result) => {
      if (!result.ok) return setError(result.message);
      setLine(result.data); setName(result.data.name); setCode(result.data.code);
    });
  }
  useEffect(load, [id]);
  useEffect(() => { fetchStops().then((result) => { if (result.ok) setAvailable(result.data.filter((stop) => stop.isActive)); }); }, []);

  const editingDirection = line?.directions.find((direction) => direction.id === editingDirectionId);
  const remaining = useMemo(() => available.filter((stop) => !editStops.some((item) => item.id === stop.id)), [available, editStops]);

  async function saveMeta() {
    const result = await updateTripLine(id, { name: name.trim(), code: code.trim().toUpperCase() });
    if (!result.ok) return setError(result.message);
    setLine(result.data); setEditMeta(false);
  }
  async function toggle() {
    if (!line) return;
    const result = await updateTripLine(id, { isActive: !line.isActive });
    if (!result.ok) return setError(result.message);
    setLine(result.data);
  }
  async function remove() {
    if (!window.confirm("هل تريد حذف خط الرحلة؟")) return;
    const result = await deleteTripLine(id);
    if (!result.ok) return setError(result.message);
    router.push("/trip-lines"); router.refresh();
  }
  function openDirectionEditor(directionId: string, stations: TripLineStop[]) {
    setEditingDirectionId(directionId);
    setEditStops(stations.map((item) => item.station));
    setPick(""); setError(null);
  }
  function addStop() {
    const stop = available.find((item) => item.id === pick);
    if (!stop) return;
    setEditStops((items) => [...items, stop]); setPick("");
  }
  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= editStops.length) return;
    setEditStops((items) => { const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }
  async function saveDirection() {
    if (!editingDirectionId || editStops.length < 2) return setError("اختر نقطتي توقف على الأقل.");
    setSaving(true);
    const result = await updateTripLineDirectionStops(id, editingDirectionId, editStops.map((stop) => ({ stopId: stop.id })));
    setSaving(false);
    if (!result.ok) return setError(result.message);
    setLine(result.data); setEditingDirectionId(null); setError(null);
  }

  if (error && !line) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!line) return <p className="text-sm text-slate-500">جاري التحميل…</p>;

  return <div className="dashboard-page"><div className="page-heading"><div><h1 className="page-title">{line.name}</h1><p className="page-description"><span dir="ltr">{line.code}</span> · خط ذهاب وعودة</p></div><div className="flex gap-2"><Button variant="secondary" onClick={toggle}>{line.isActive ? "إيقاف الخط" : "تفعيل الخط"}</Button><Button onClick={() => setEditMeta(true)}><Pencil className="size-4" /> تعديل البيانات</Button></div></div>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<div className="grid gap-4 xl:grid-cols-2">{line.directions.map((direction) => <section key={direction.id} className="panel-card p-5 sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="section-title">{direction.direction === "OUTBOUND" ? "اتجاه الذهاب" : "اتجاه العودة"}</h2><p className="text-sm text-slate-500">{direction.origin} ← {direction.destination}</p></div><Button size="sm" variant="secondary" onClick={() => openDirectionEditor(direction.id, direction.stations)}><Pencil className="size-4" /> تعديل التوقفات</Button></div><ol className="space-y-0">{direction.stations.map((item, index) => <li key={item.id} className="flex gap-3"><div className="flex flex-col items-center"><span className="grid size-8 place-items-center rounded-full bg-[#2f719e] text-sm font-bold text-white">{item.stopOrder}</span>{index < direction.stations.length - 1 && <span className="my-1 h-8 border-r-2 border-dashed border-[#9cc2dc]" />}</div><div className="pb-4"><strong>{item.station.name}</strong><p className="text-sm text-slate-500">{item.station.address}</p></div></li>)}</ol></section>)}</div>
    <Dialog open={editMeta} onOpenChange={setEditMeta} title="تعديل بيانات خط الرحلة" description="اسم وكود الخط المشترك بين الاتجاهين." size="sm"><div className="space-y-4"><label className="block text-sm"><span className="mb-1 block font-medium">اسم الخط</span><Input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="block text-sm"><span className="mb-1 block font-medium">كود الخط</span><Input dir="ltr" value={code} onChange={(event) => setCode(event.target.value)} /></label><div className="flex justify-between border-t pt-4"><Button variant="destructive" onClick={remove}>حذف الخط</Button><Button onClick={saveMeta}>حفظ</Button></div></div></Dialog>
    <Dialog open={Boolean(editingDirection)} onOpenChange={(open) => { if (!open) setEditingDirectionId(null); }} title={editingDirection?.direction === "OUTBOUND" ? "تعديل توقفات الذهاب" : "تعديل توقفات العودة"} description="أضف أو احذف أو غيّر الترتيب. لا يؤثر ذلك في الاتجاه الآخر." size="lg"><div className="space-y-4"><div className="flex gap-2 rounded-2xl bg-slate-50 p-2"><select aria-label="اختر نقطة توقف لإضافتها" value={pick} onChange={(event) => setPick(event.target.value)} className="select-field min-w-0 flex-1"><option value="">اختر نقطة توقف…</option>{remaining.map((stop) => <option key={stop.id} value={stop.id}>{stop.name} · {stop.address}</option>)}</select><Button type="button" variant="secondary" onClick={addStop} disabled={!pick}><Plus className="size-4" /> إضافة</Button></div><ol className="space-y-2">{editStops.map((stop, index) => <li key={stop.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#2f719e] text-sm font-bold text-white">{index + 1}</span><MapPin className="size-4 shrink-0 text-[#2f719e]" /><span className="min-w-0 flex-1"><strong className="block truncate">{stop.name}</strong><small className="block truncate text-slate-500">{stop.address}</small></span><Button type="button" variant="ghost" size="icon" aria-label="نقل للأعلى" onClick={() => move(index, -1)} disabled={index === 0}><ArrowUp /></Button><Button type="button" variant="ghost" size="icon" aria-label="نقل للأسفل" onClick={() => move(index, 1)} disabled={index === editStops.length - 1}><ArrowDown /></Button><Button type="button" variant="ghost" size="icon" aria-label="حذف التوقف" onClick={() => setEditStops((items) => items.filter((item) => item.id !== stop.id))}><Trash2 className="text-red-600" /></Button></li>)}</ol><p className="text-xs text-slate-500">الاتجاهات المرتبطة برحلات لا يمكن تغيير توقفاتها للحفاظ على السجل التشغيلي.</p><div className="flex justify-end gap-2 border-t pt-4"><Button variant="secondary" onClick={() => setEditingDirectionId(null)}>إلغاء</Button><Button onClick={saveDirection} disabled={saving || editStops.length < 2}>{saving ? "جاري الحفظ…" : "حفظ التوقفات"}</Button></div></div></Dialog>
  </div>;
}
