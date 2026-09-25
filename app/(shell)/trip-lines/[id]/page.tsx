"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, MapPin, Pencil, Plus, Route, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteTripLine, fetchStops, fetchTripLine, updateTripLine, updateTripLineDirectionStops, type Stop, type TripLine, type TripLineStop } from "@/lib/actions/trip-lines";

type StopUse = "BOARDING" | "LANDING" | "BOTH";
// Row identity is the route-station row (server id once loaded, client key for
// newly added rows) — NOT the station id. A converted BOTH station appears as
// an adjacent BOARDING + LANDING pair sharing one station id, so keying or
// deleting by station id would collapse/remove both twins.
type EditableStop = { key: string; stop: Stop; stopType: StopUse };
type DirectionKey = "OUTBOUND" | "RETURN";

const directionLabels: Record<DirectionKey, string> = { OUTBOUND: "اتجاه الذهاب", RETURN: "اتجاه العودة" };
const stopUseLabels: Record<StopUse, string> = { BOTH: "ركوب ونزول", BOARDING: "ركوب فقط", LANDING: "نزول فقط" };

function routeSummary(stations: TripLineStop[]) {
  if (stations.length < 2) return "غير مكتمل";
  return `${stations[0].station.name} ← ${stations.at(-1)?.station.name}`;
}

export default function TripLineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [line, setLine] = useState<TripLine | null>(null);
  const [available, setAvailable] = useState<Stop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editMeta, setEditMeta] = useState(false);
  const [editingDirectionId, setEditingDirectionId] = useState<string | null>(null);
  const [viewDirection, setViewDirection] = useState<DirectionKey>("OUTBOUND");
  const [editStops, setEditStops] = useState<EditableStop[]>([]);
  const [pick, setPick] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const keySeq = useRef(0);
  function nextRowKey(stopId: string) {
    keySeq.current += 1;
    return `${stopId}#new-${keySeq.current}`;
  }

  function load() {
    fetchTripLine(id).then((result) => {
      if (!result.ok) return setError(result.message);
      setLine(result.data);
      setName(result.data.name);
      setCode(result.data.code);
    });
  }

  useEffect(load, [id]);
  useEffect(() => {
    fetchStops().then((result) => {
      if (result.ok) setAvailable(result.data.filter((stop) => stop.isActive));
    });
  }, []);

  const activeDirection = line?.directions.find((item) => item.direction === viewDirection) ?? line?.directions[0];
  const editingDirection = line?.directions.find((item) => item.id === editingDirectionId);
  // A stop may be picked twice so operators can build a BOARDING + LANDING pair;
  // a third copy can never validate server-side (DUPLICATE_STOP).
  const remaining = useMemo(() => available.filter((stop) => editStops.filter((item) => item.stop.id === stop.id).length < 2), [available, editStops]);

  async function saveMeta() {
    const result = await updateTripLine(id, { name: name.trim(), code: code.trim().toUpperCase() });
    if (!result.ok) return setError(result.message);
    setLine(result.data);
    setEditMeta(false);
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
    router.push("/trip-lines");
    router.refresh();
  }

  function openDirectionEditor(directionId: string, stations: TripLineStop[]) {
    setEditingDirectionId(directionId);
    setEditStops(stations.map((item) => ({ key: item.id, stop: item.station, stopType: item.stopType })));
    setPick("");
    setError(null);
  }

  function addStop() {
    const stop = available.find((item) => item.id === pick);
    if (!stop) return;
    if (editStops.filter((item) => item.stop.id === stop.id).length >= 2) return;
    // Second copy of a stop defaults to the opposite capability so the pair is
    // valid as written; the server still enforces BOARDING + LANDING.
    const existing = editStops.find((item) => item.stop.id === stop.id);
    const stopType: StopUse = existing ? (existing.stopType === "BOARDING" ? "LANDING" : "BOARDING") : "BOARDING";
    setEditStops((items) => [...items, { key: nextRowKey(stop.id), stop, stopType }]);
    setPick("");
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= editStops.length) return;
    setEditStops((items) => {
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function saveDirection() {
    if (!editingDirectionId || editStops.length < 2) return setError("اختر نقطتي توقف على الأقل.");
    if (editStops.some((item) => item.stopType === "BOTH")) return setError("غيّر نقاط «ركوب ونزول (قديم)» إلى ركوب فقط أو نزول فقط قبل الحفظ.");
    setSaving(true);
    const result = await updateTripLineDirectionStops(id, editingDirectionId, editStops.map((item) => ({ stopId: item.stop.id, stopType: item.stopType as "BOARDING" | "LANDING" })));
    setSaving(false);
    if (!result.ok) return setError(result.message);
    setLine(result.data);
    setEditingDirectionId(null);
    setError(null);
  }

  if (error && !line) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!line) return <p className="text-sm text-slate-500">جاري التحميل…</p>;

  return <div className="dashboard-page space-y-5">
    <div className="page-heading gap-4">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-extrabold ${line.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{line.isActive ? "خط نشط" : "خط متوقف"}</span><span dir="ltr" className="rounded-full bg-[#eaf4fa] px-3 py-1 text-xs font-extrabold text-[#285778]">{line.code}</span></div>
        <h1 className="page-title">{line.name}</h1>
        <p className="page-description">خط واحد باتجاهين مستقلين؛ توقفات العودة قابلة للتعديل دون التأثير على الذهاب.</p>
      </div>
      <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={toggle}>{line.isActive ? "إيقاف الخط" : "تفعيل الخط"}</Button><Button onClick={() => setEditMeta(true)}><Pencil className="size-4" /> تعديل بيانات الخط</Button></div>
    </div>

    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

    <section className="overflow-hidden rounded-[1.5rem] border border-[#cfe1ec] bg-gradient-to-br from-[#edf6fc] via-white to-[#fff7e3]/60">
      <div className="flex flex-col gap-3 border-b border-[#dce8ef] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-2 text-[#204c6b]"><Route className="size-5" /><div><h2 className="font-extrabold">مسار الخط</h2><p className="mt-0.5 text-xs text-[#687886]">اختر اتجاهًا لمراجعة التوقفات أو تعديلها بنفس أدوات الإنشاء.</p></div></div>
        {activeDirection && <Button variant="secondary" onClick={() => openDirectionEditor(activeDirection.id, activeDirection.stations)}><Pencil className="size-4" /> تعديل {directionLabels[activeDirection.direction]}</Button>}
      </div>
      <div className="grid grid-cols-2 gap-2 border-b border-[#dce8ef] bg-white/70 p-3">{(["OUTBOUND", "RETURN"] as const).map((key) => {
        const direction = line.directions.find((item) => item.direction === key);
        return <button key={key} type="button" onClick={() => setViewDirection(key)} className={`rounded-xl px-3 py-2.5 text-sm font-bold transition ${viewDirection === key ? "bg-[#204c6b] text-white shadow-sm" : "bg-[#edf4f8] text-[#486274] hover:bg-[#daeaf5]"}`}>{directionLabels[key]} <span className="mr-1 text-xs opacity-80">({direction?.stations.length ?? 0})</span></button>;
      })}</div>
      <div className="p-4 sm:p-5">
        {activeDirection ? <ol className="space-y-0">{activeDirection.stations.map((item, index) => <li key={item.id} className="flex gap-3"><div className="flex w-8 shrink-0 flex-col items-center"><span className={`grid size-8 place-items-center rounded-full text-xs font-extrabold ${index === 0 ? "bg-[#204c6b] text-white" : index === activeDirection.stations.length - 1 ? "bg-[#2f719e] text-white" : "bg-[#daeaf5] text-[#204c6b]"}`}>{index + 1}</span>{index < activeDirection.stations.length - 1 && <span className="my-1 min-h-5 flex-1 border-r-2 border-dashed border-[#9dc2da]" />}</div><div className="mb-2 flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-[#dbe7ee]"><MapPin className="size-4 shrink-0 text-[#2f719e]" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.station.name}</strong><small className="block truncate text-xs text-[#687886]">{item.station.address || item.station.governorate?.nameAr}</small></span><span className="shrink-0 rounded-full bg-[#eaf4fa] px-2.5 py-1 text-xs font-bold text-[#285778]">{stopUseLabels[item.stopType]}</span></div></li>)}</ol> : <div className="rounded-2xl border border-dashed border-[#b9d2e3] bg-white/70 px-5 py-9 text-center"><MapPin className="mx-auto mb-2 size-7 text-[#2f719e]" /><p className="font-bold text-[#334454]">لا توجد توقفات لهذا الاتجاه</p></div>}
      </div>
    </section>

    <section className="grid gap-3 rounded-2xl bg-[#10153c] p-4 text-white sm:grid-cols-2"><p><span className="text-xs text-[#9ed0f0]">ذهاب</span><br /><strong>{routeSummary(line.directions.find((item) => item.direction === "OUTBOUND")?.stations ?? [])}</strong></p><p><span className="text-xs text-[#9ed0f0]">عودة</span><br /><strong>{routeSummary(line.directions.find((item) => item.direction === "RETURN")?.stations ?? [])}</strong></p></section>

    <Dialog open={editMeta} onOpenChange={setEditMeta} title="تعديل بيانات خط الرحلة" description="اسم وكود الخط المشترك بين الاتجاهين." size="sm"><div className="space-y-4"><label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">اسم الخط</span><Input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">كود الخط</span><Input dir="ltr" value={code} onChange={(event) => setCode(event.target.value)} /></label><div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between"><Button variant="destructive" onClick={remove}>حذف الخط</Button><Button onClick={saveMeta}>حفظ التعديلات</Button></div></div></Dialog>

    <Dialog open={Boolean(editingDirection)} onOpenChange={(open) => { if (!open) setEditingDirectionId(null); }} title={`تعديل ${editingDirection ? directionLabels[editingDirection.direction] : "المسار"}`} description="أضف أو احذف أو غيّر الترتيب وحدد ما إذا كانت كل نقطة للركوب أو النزول أو الاثنين." size="lg"><div className="space-y-5"><div className="flex gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-[#dbe7ee]"><select aria-label="اختيار نقطة توقف" value={pick} onChange={(event) => setPick(event.target.value)} className="select-field min-w-0 flex-1 border-0 bg-transparent"><option value="">اختر نقطة لإضافتها إلى {editingDirection ? directionLabels[editingDirection.direction] : "المسار"}…</option>{remaining.map((stop) => <option key={stop.id} value={stop.id}>{stop.name} · {stop.address || stop.governorate?.nameAr}</option>)}</select><Button type="button" variant="secondary" onClick={addStop} disabled={!pick}><Plus className="size-4" /> إضافة</Button></div>
      {editStops.length === 0 ? <div className="rounded-2xl border border-dashed border-[#b9d2e3] bg-[#f8fbfd] px-5 py-9 text-center"><MapPin className="mx-auto mb-2 size-7 text-[#2f719e]" /><p className="font-bold text-[#334454]">أضف توقفات هذا الاتجاه</p></div> : <ol className="space-y-0">{editStops.map((item, index) => <li key={item.key} className="flex gap-3"><div className="flex w-8 shrink-0 flex-col items-center"><span className={`grid size-8 place-items-center rounded-full text-xs font-extrabold ${index === 0 ? "bg-[#204c6b] text-white" : index === editStops.length - 1 ? "bg-[#2f719e] text-white" : "bg-[#daeaf5] text-[#204c6b]"}`}>{index + 1}</span>{index < editStops.length - 1 && <span className="my-1 min-h-5 flex-1 border-r-2 border-dashed border-[#9dc2da]" />}</div><div className="mb-2 flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-[#dbe7ee]"><MapPin className="size-4 shrink-0 text-[#2f719e]" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.stop.name}</strong><small className="block truncate text-xs text-[#687886]">{item.stop.address || item.stop.governorate?.nameAr}</small></span><select aria-label="نوع التوقف" value={item.stopType} onChange={(event) => setEditStops((items) => items.map((entry, entryIndex) => entryIndex === index ? { ...entry, stopType: event.target.value as StopUse } : entry))} className="select-field w-28 shrink-0 py-2 text-xs">{item.stopType === "BOTH" ? <option value="BOTH" disabled>ركوب ونزول (قديم)</option> : null}<option value="BOARDING">ركوب فقط</option><option value="LANDING">نزول فقط</option></select><div className="flex shrink-0"><Button type="button" variant="ghost" size="icon" aria-label="نقل للأعلى" onClick={() => move(index, -1)} disabled={index === 0}><ArrowUp /></Button><Button type="button" variant="ghost" size="icon" aria-label="نقل للأسفل" onClick={() => move(index, 1)} disabled={index === editStops.length - 1}><ArrowDown /></Button><Button type="button" variant="ghost" size="icon" aria-label="حذف النقطة" onClick={() => setEditStops((items) => items.filter((_, entryIndex) => entryIndex !== index))}><Trash2 className="text-red-600" /></Button></div></div></li>)}</ol>}
      <div className="rounded-2xl bg-[#10153c] p-4 text-white"><span className="text-xs text-[#9ed0f0]">ملخص {editingDirection ? directionLabels[editingDirection.direction] : "المسار"}</span><br /><strong>{editStops.length >= 2 ? `${editStops[0].stop.name} ← ${editStops.at(-1)?.stop.name}` : "غير مكتمل"}</strong></div><p className="text-xs text-[#687886]">لن تُحفظ التغييرات إلا عند وجود نقطتي توقف على الأقل. الاتجاهات المرتبطة برحلات لا يمكن تغيير توقفاتها للحفاظ على السجل التشغيلي.</p><div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-5 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={() => setEditingDirectionId(null)}>إلغاء</Button><Button onClick={saveDirection} disabled={saving || editStops.length < 2}>{saving ? "جاري الحفظ…" : "حفظ التوقفات"}</Button></div></div></Dialog>
  </div>;
}
