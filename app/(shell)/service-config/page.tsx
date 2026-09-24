"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchServiceConfig,
  replaceServiceConfig,
  type ServiceConfigEntry,
  type ServiceConfigEntryInput,
} from "@/lib/actions/service-config";

const TYPE_AR: Record<string, string> = {
  PHONE: "هاتف",
  WHATSAPP: "واتساب",
  WEBSITE: "موقع",
};

type Draft = ServiceConfigEntryInput & { key: string };

export default function ServiceConfigPage() {
  const [rows, setRows] = useState<Draft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchServiceConfig().then((result) => {
      if (result.ok) {
        setRows(
          (result.data as ServiceConfigEntry[])
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((e) => ({ key: e.id, id: e.id, text: e.text, type: e.type, value: e.value, isActive: e.isActive })),
        );
      } else setError(result.message);
    });
  }, []);

  function add() {
    setRows((items) => [...(items ?? []), { key: `new-${Date.now()}`, text: "", type: "PHONE", value: "", isActive: true }]);
  }

  function patch(key: string, field: keyof Draft, val: string | boolean) {
    setSaved(false);
    setRows((items) => items?.map((r) => (r.key === key ? { ...r, [field]: val } : r)) ?? []);
  }

  function move(key: string, dir: -1 | 1) {
    setSaved(false);
    setRows((items) => {
      if (!items) return items;
      const idx = items.findIndex((r) => r.key === key);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= items.length) return items;
      const copy = items.slice();
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }

  function remove(key: string) {
    setSaved(false);
    setRows((items) => items?.filter((r) => r.key !== key) ?? []);
  }

  async function save() {
    if (!rows) return;
    for (const r of rows) {
      if (!r.text.trim() || !r.value.trim()) {
        setError("أكمل النص والقيمة لكل عنصر قبل الحفظ.");
        return;
      }
    }
    setSaving(true);
    const result = await replaceServiceConfig(
      rows.map(({ key: _key, ...rest }) => rest),
    );
    setSaving(false);
    if (!result.ok) return setError(result.message);
    setRows(
      result.data
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((e) => ({ key: e.id, id: e.id, text: e.text, type: e.type, value: e.value, isActive: e.isActive })),
    );
    setError(null);
    setSaved(true);
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1 className="page-title">خدمة العملاء والإعلانات</h1>
          <p className="page-description">قائمة مرتبة تظهر في التطبيق — الترتيب هنا هو ترتيب الظهور. الحفظ يرسل القائمة كاملة.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={add}><Plus className="size-4" /> عنصر جديد</Button>
          <Button onClick={() => void save()} disabled={saving || !rows}>{saving ? "جاري الحفظ…" : "حفظ القائمة"}</Button>
        </div>
      </div>
      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {saved ? <p className="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">تم الحفظ بنجاح.</p> : null}
      {!rows ? <p className="text-sm text-slate-500">جاري التحميل…</p> : rows.length === 0 ? <p className="text-sm text-slate-500">القائمة فارغة — أضف أول عنصر.</p> : (
        <div className="space-y-3">
          {rows.map((row, idx) => (
            <div key={row.key} className="rounded-2xl border border-[#e4ecf2] bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className={row.isActive ? "status-pill" : "status-pill status-pill-muted"}>{row.isActive ? "ظاهر" : "مخفي"} · {TYPE_AR[row.type]}</span>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="secondary" onClick={() => move(row.key, -1)} disabled={idx === 0}><ArrowUp className="size-4" /></Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => move(row.key, 1)} disabled={idx === rows.length - 1}><ArrowDown className="size-4" /></Button>
                  <Button type="button" size="sm" variant="destructive" onClick={() => remove(row.key)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">النص</span><Input value={row.text} onChange={(event) => patch(row.key, "text", event.target.value)} placeholder="تواصل مع خدمة العملاء" /></label>
                <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">القيمة</span><Input dir="ltr" value={row.value} onChange={(event) => patch(row.key, "value", event.target.value)} placeholder="011xxxxxxxx أو https://…" /></label>
                <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">النوع</span><select className="w-full rounded-xl border border-[#d7e1ea] bg-white p-2.5" value={row.type} onChange={(event) => patch(row.key, "type", event.target.value)}><option value="PHONE">هاتف</option><option value="WHATSAPP">واتساب</option><option value="WEBSITE">موقع</option></select></label>
                <label className="flex items-center gap-2 rounded-xl bg-[#f8fbfd] p-3 text-sm"><input type="checkbox" checked={row.isActive ?? true} onChange={(event) => patch(row.key, "isActive", event.target.checked)} className="size-4 accent-[#2f719e]" /> ظاهر في التطبيق</label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
