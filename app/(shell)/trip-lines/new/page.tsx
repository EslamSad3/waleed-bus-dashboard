"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, MapPin, Plus, Route, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RouteDialog } from "@/components/ui/route-dialog";
import { createTripLine, fetchStops, type Stop } from "@/lib/actions/trip-lines";

type Direction = "outbound" | "return";
const labels: Record<Direction, string> = { outbound: "اتجاه الذهاب", return: "اتجاه العودة" };

export default function NewTripLinePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [available, setAvailable] = useState<Stop[]>([]);
  const [direction, setDirection] = useState<Direction>("outbound");
  const [outbound, setOutbound] = useState<Stop[]>([]);
  const [returnStops, setReturnStops] = useState<Stop[]>([]);
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = direction === "outbound" ? outbound : returnStops;
  const setSelected = direction === "outbound" ? setOutbound : setReturnStops;
  const remaining = useMemo(() => available.filter((stop) => !selected.some((item) => item.id === stop.id)), [available, selected]);

  useEffect(() => {
    fetchStops().then((result) => {
      if (result.ok) setAvailable(result.data.filter((stop) => stop.isActive));
      else setError(result.message);
    });
  }, []);

  function addStop() {
    const stop = available.find((item) => item.id === pick);
    if (!stop) return;
    setSelected((items) => [...items, stop]);
    setPick("");
    setError(null);
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= selected.length) return;
    setSelected((items) => {
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function copyAndReverseOutbound() {
    if (outbound.length < 2) return setError("أضف نقطتي توقف على الأقل في اتجاه الذهاب أولًا.");
    setReturnStops([...outbound].reverse());
    setDirection("return");
    setPick("");
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !code.trim() || outbound.length < 2 || returnStops.length < 2) {
      setError("أدخل الاسم والكود وحدد نقطتي توقف على الأقل في كل اتجاه.");
      return;
    }
    setError(null);
    setSaving(true);
    const result = await createTripLine({
      name: name.trim(), code: code.trim().toUpperCase(),
      outboundStops: outbound.map((stop) => ({ stopId: stop.id })),
      returnStops: returnStops.map((stop) => ({ stopId: stop.id })),
    });
    setSaving(false);
    if (!result.ok) return setError(result.message);
    router.push(`/trip-lines/${result.data.id}`);
    router.refresh();
  }

  const routeSummary = (stops: Stop[]) => stops.length >= 2 ? `${stops[0].name} ← ${stops.at(-1)?.name}` : "غير مكتمل";

  return <RouteDialog title="إنشاء خط رحلة" description="أنشئ خطًا واحدًا باتجاهي ذهاب وعودة مستقلين." fallbackHref="/trip-lines" size="lg">
    <form className="space-y-6" onSubmit={submit}>
      <div className="grid gap-3 rounded-2xl border border-[#dce8ef] bg-[#f8fbfd] p-4 sm:grid-cols-[1fr_12rem]">
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">اسم الخط</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="القاهرة ↔ بني سويف" /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">كود الخط</span><Input dir="ltr" value={code} onChange={(event) => setCode(event.target.value)} placeholder="CAI-BNS" /></label>
      </div>

      <section className="overflow-hidden rounded-[1.5rem] border border-[#cfe1ec] bg-gradient-to-br from-[#edf6fc] via-white to-[#fff7e3]/60">
        <div className="flex flex-col gap-3 border-b border-[#dce8ef] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="flex items-center gap-2 text-[#204c6b]"><Route className="size-5" /><div><h3 className="font-extrabold">مسار الخط</h3><p className="mt-0.5 text-xs font-normal text-[#687886]">العودة مستقلة ويمكن أن تختلف توقفاتها عن الذهاب.</p></div></div><Button type="button" variant="secondary" onClick={copyAndReverseOutbound} disabled={outbound.length < 2}><Copy className="size-4" /> نسخ وعكس الذهاب</Button></div>
        <div className="grid grid-cols-2 gap-2 border-b border-[#dce8ef] bg-white/70 p-3">{(["outbound", "return"] as const).map((item) => <button key={item} type="button" onClick={() => { setDirection(item); setPick(""); setError(null); }} className={`rounded-xl px-3 py-2.5 text-sm font-bold transition ${direction === item ? "bg-[#204c6b] text-white shadow-sm" : "bg-[#edf4f8] text-[#486274] hover:bg-[#daeaf5]"}`}>{labels[item]} <span className="mr-1 text-xs opacity-80">({item === "outbound" ? outbound.length : returnStops.length})</span></button>)}</div>
        <div className="p-4 sm:p-5">
          <div className="flex gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-[#dbe7ee]"><select aria-label="اختيار نقطة توقف" value={pick} onChange={(event) => setPick(event.target.value)} className="select-field min-w-0 flex-1 border-0 bg-transparent"><option value="">اختر نقطة لإضافتها إلى {labels[direction]}…</option>{remaining.map((stop) => <option key={stop.id} value={stop.id}>{stop.name} · {stop.address}</option>)}</select><Button type="button" variant="secondary" onClick={addStop} disabled={!pick}><Plus className="size-4" /> إضافة</Button></div>
          {selected.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-[#b9d2e3] bg-white/70 px-5 py-9 text-center"><MapPin className="mx-auto mb-2 size-7 text-[#2f719e]" /><p className="font-bold text-[#334454]">أضف توقفات {labels[direction]}</p><p className="mt-1 text-sm text-[#687886]">يمكن نسخ وعكس الذهاب كبداية ثم تعديل العودة كما تحتاج.</p></div> : <ol className="mt-4 space-y-0">{selected.map((stop, index) => <li key={stop.id} className="flex gap-3"><div className="flex w-8 shrink-0 flex-col items-center"><span className={`grid size-8 place-items-center rounded-full text-xs font-extrabold ${index === 0 ? "bg-[#204c6b] text-white" : index === selected.length - 1 ? "bg-[#2f719e] text-white" : "bg-[#daeaf5] text-[#204c6b]"}`}>{index + 1}</span>{index < selected.length - 1 && <span className="my-1 min-h-5 flex-1 border-r-2 border-dashed border-[#9dc2da]" />}</div><div className="mb-2 flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-[#dbe7ee]"><MapPin className="size-4 shrink-0 text-[#2f719e]" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{stop.name}</strong><small className="block truncate text-xs text-[#687886]">{stop.address}</small></span><div className="flex shrink-0"><Button type="button" variant="ghost" size="icon" aria-label="نقل للأعلى" onClick={() => move(index, -1)} disabled={index === 0}><ArrowUp /></Button><Button type="button" variant="ghost" size="icon" aria-label="نقل للأسفل" onClick={() => move(index, 1)} disabled={index === selected.length - 1}><ArrowDown /></Button><Button type="button" variant="ghost" size="icon" aria-label="حذف النقطة" onClick={() => setSelected((items) => items.filter((item) => item.id !== stop.id))}><Trash2 className="text-red-600" /></Button></div></div></li>)}</ol>}
        </div>
      </section>
      <div className="grid gap-3 rounded-2xl bg-[#10153c] p-4 text-white sm:grid-cols-2"><p><span className="text-xs text-[#9ed0f0]">ذهاب</span><br /><strong>{routeSummary(outbound)}</strong></p><p><span className="text-xs text-[#9ed0f0]">عودة</span><br /><strong>{routeSummary(returnStops)}</strong></p></div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={() => router.push("/trip-lines")}>إلغاء</Button><Button type="submit" disabled={saving || outbound.length < 2 || returnStops.length < 2}>{saving ? "جاري الحفظ…" : "إنشاء خط الرحلة"}</Button></div>
    </form>
  </RouteDialog>;
}
