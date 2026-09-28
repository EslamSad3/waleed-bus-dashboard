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
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { FormSkeleton } from "@/components/ui/skeletons";
import { t } from "@/lib/i18n/t";

const TYPE_AR: Record<string, string> = {
  PHONE: t("enums.serviceConfigType.phone"),
  WHATSAPP: t("enums.serviceConfigType.whatsapp"),
  WEBSITE: t("enums.serviceConfigType.website"),
};

type Draft = ServiceConfigEntryInput & { key: string };

export default function ServiceConfigPage() {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Draft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: config, isLoading, error: fetchError } = useApiQuery<ServiceConfigEntry[]>(qk.serviceConfig, fetchServiceConfig);

  // Render-phase sync from the query cache (no setState-in-effect)
  const [seenConfig, setSeenConfig] = useState<ServiceConfigEntry[] | null>(null);
  if (config && config !== seenConfig) {
    setSeenConfig(config);
    setRows(
      config
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((e) => ({ key: e.id, id: e.id, text: e.text, type: e.type, value: e.value, isActive: e.isActive })),
    );
  }

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
        setError(t("serviceConfig.errors.rowRequired"));
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
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("serviceConfig.title")}</h1>
          <p className="page-description">{t("serviceConfig.description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-md:w-full">
          <Button variant="secondary" className="max-md:w-full" onClick={add}><Plus className="size-4" /> {t("serviceConfig.addItem")}</Button>
          <Button className="max-md:w-full" onClick={() => void save()} loading={saving} disabled={!rows}>{saving ? t("common.loading.saving") : t("serviceConfig.saveList")}</Button>
        </div>
      </div>
      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {saved ? <p className="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{t("serviceConfig.saved")}</p> : null}
      {!rows ? (fetchError ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{fetchError.message}</p> : <FormSkeleton fields={4} />) : rows.length === 0 ? <p className="text-sm text-slate-500">{t("serviceConfig.empty")}</p> : (
        <div className="space-y-3">
          {rows.map((row, idx) => (
            <div key={row.key} className="min-w-0 rounded-2xl border border-[#e4ecf2] bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className={row.isActive ? "status-pill" : "status-pill status-pill-muted"}>{row.isActive ? t("serviceConfig.visible") : t("serviceConfig.hidden")} · {TYPE_AR[row.type]}</span>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="secondary" onClick={() => move(row.key, -1)} disabled={idx === 0}><ArrowUp className="size-4" /></Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => move(row.key, 1)} disabled={idx === rows.length - 1}><ArrowDown className="size-4" /></Button>
                  <Button type="button" size="sm" variant="destructive" onClick={() => remove(row.key)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("serviceConfig.fields.text")}</span><Input value={row.text} onChange={(event) => patch(row.key, "text", event.target.value)} placeholder={t("serviceConfig.placeholders.text")} /></label>
                <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("serviceConfig.fields.value")}</span><Input dir="ltr" value={row.value} onChange={(event) => patch(row.key, "value", event.target.value)} placeholder={t("serviceConfig.placeholders.value")} /></label>
                <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.type")}</span><select className="w-full rounded-xl border border-[#d7e1ea] bg-white p-2.5" value={row.type} onChange={(event) => patch(row.key, "type", event.target.value)}><option value="PHONE">{t("enums.serviceConfigType.phone")}</option><option value="WHATSAPP">{t("enums.serviceConfigType.whatsapp")}</option><option value="WEBSITE">{t("enums.serviceConfigType.website")}</option></select></label>
                <label className="flex items-center gap-2 rounded-xl bg-[#f8fbfd] p-3 text-sm"><input type="checkbox" checked={row.isActive ?? true} onChange={(event) => patch(row.key, "isActive", event.target.checked)} className="size-4 accent-[#059ff8]" /> {t("serviceConfig.visibleInApp")}</label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
