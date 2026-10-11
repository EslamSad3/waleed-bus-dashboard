"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { platformSettingsSchema } from "@/lib/schemas/admin-forms";
import { schemaErrors } from "@/lib/field-validation";
import { useFieldValidation, ValidationScope } from "@/components/ui/field-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSkeleton } from "@/components/ui/skeletons";
import { fetchPlatformSettings, updatePlatformSettings, type PlatformSettings } from "@/lib/actions/platform-settings";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

/** Platform-wide settings the super admin controls (today: the trip-search range). */
export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [maxSearchDays, setMaxSearchDays] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: settings, error: fetchError } = useApiQuery<PlatformSettings>(qk.platformSettings, fetchPlatformSettings);

  // Render-phase sync from the query cache (no setState-in-effect)
  const [seen, setSeen] = useState<PlatformSettings | null>(null);
  if (settings && settings !== seen) {
    setSeen(settings);
    setMaxSearchDays(String(settings.maxSearchDays));
  }

  const parsedDays = () => (maxSearchDays.trim() === "" ? undefined : Number(maxSearchDays));
  const validation = useFieldValidation(() => schemaErrors(platformSettingsSchema, { maxSearchDays: parsedDays() }));

  async function save() {
    if (!validation.validate()) return;
    setSaving(true);
    const result = await updatePlatformSettings({ maxSearchDays: parsedDays()! });
    setSaving(false);
    if (!result.ok) return setError(validation.failure(result));
    queryClient.setQueryData(qk.platformSettings, result.data);
    setError(null);
    setSaved(true);
  }

  return (
    <ValidationScope validation={validation}><div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("settings.title")}</h1>
          <p className="page-description">{t("settings.description")}</p>
        </div>
      </div>
      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {saved ? <p className="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{t("settings.saved")}</p> : null}
      {!settings ? (fetchError ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{fetchError.message}</p> : <FormSkeleton fields={1} />) : (
        <form noValidate
          className="max-w-xl rounded-2xl border border-[#e4ecf2] bg-white p-5"
          onSubmit={(event) => { event.preventDefault(); void save(); }}
        >
          <h2 className="mb-1 flex items-center gap-2 text-base font-extrabold text-[#00134c]"><CalendarRange className="size-5" />{t("settings.search.title")}</h2>
          <p className="mb-4 text-sm text-[#687886]">{t("settings.search.description")}</p>
          <label className="block text-sm">
            <span className="mb-1.5 block font-bold text-[#334454]">{t("settings.search.maxSearchDays")}</span>
            <Input fieldName="maxSearchDays" dir="ltr" inputMode="numeric" type="number" min={1} max={90} className="max-w-40"
              value={maxSearchDays}
              onChange={(event) => { setSaved(false); setMaxSearchDays(event.target.value); }}
            />
            <small className="mt-1 block text-xs text-[#687886]">{t("settings.search.hint")}</small>
          </label>
          <div className="mt-5 flex justify-end border-t border-[#e4ecf2] pt-4">
            <Button type="submit" loading={saving}>{saving ? t("common.loading.saving") : t("common.actions.save")}</Button>
          </div>
        </form>
      )}
    </div></ValidationScope>
  );
}
