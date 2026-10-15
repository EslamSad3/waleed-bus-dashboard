"use client";

import { useEffect, useState } from "react";
import { CalendarRange, Activity, User, Shield, LogOut, CheckCircle2, XCircle, Users } from "lucide-react";
import { platformSettingsSchema } from "@/lib/schemas/admin-forms";
import { schemaErrors } from "@/lib/field-validation";
import { useFieldValidation, ValidationScope } from "@/components/ui/field-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSkeleton } from "@/components/ui/skeletons";
import { fetchPlatformSettings, updatePlatformSettings, type PlatformSettings } from "@/lib/actions/platform-settings";
import { fetchSessionIdentity, type SessionIdentity } from "@/lib/actions/session";
import { qk, useApiQuery, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [maxSearchDays, setMaxSearchDays] = useState("");
  const [maxSeats, setMaxSeats] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Platform Settings
  const { data: settings, error: fetchError } = useApiQuery<PlatformSettings>(
    qk.platformSettings,
    fetchPlatformSettings,
  );

  // Current Session Identity
  const { data: session } = useApiQuery<SessionIdentity>(qk.session, fetchSessionIdentity);

  // System Health
  const [healthStatus, setHealthStatus] = useState<"ok" | "down" | "checking">("checking");
  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((res) => {
        if (cancelled) return;
        setHealthStatus(res.ok ? "ok" : "down");
      })
      .catch(() => {
        if (!cancelled) setHealthStatus("down");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Render-phase sync from the query cache (no setState-in-effect)
  const [seen, setSeen] = useState<PlatformSettings | null>(null);
  if (settings && settings !== seen) {
    setSeen(settings);
    setMaxSearchDays(String(settings.maxSearchDays));
    setMaxSeats(String(settings.maxSeats ?? 5));
  }

  const parsedDays = () => (maxSearchDays.trim() === "" ? undefined : Number(maxSearchDays));
  const parsedSeats = () => (maxSeats.trim() === "" ? undefined : Number(maxSeats));
  const validation = useFieldValidation(() =>
    schemaErrors(platformSettingsSchema, {
      maxSearchDays: parsedDays(),
      maxSeats: parsedSeats(),
    }),
  );

  async function save() {
    if (!validation.validate()) return;
    setSaving(true);
    const result = await updatePlatformSettings({
      maxSearchDays: parsedDays()!,
      maxSeats: parsedSeats()!,
    });
    setSaving(false);
    if (!result.ok) return setError(validation.failure(result));
    queryClient.setQueryData(qk.platformSettings, result.data);
    void queryClient.invalidateQueries({ queryKey: qk.session });
    void queryClient.invalidateQueries({ queryKey: qk.adminUsers });
    setError(null);
    setSaved(true);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <ValidationScope validation={validation}>
      <div className="dashboard-page space-y-6">
        <div className="page-heading">
          <div className="min-w-0 flex-1">
            <h1 className="page-title">{t("settings.title")}</h1>
            <p className="page-description">{t("settings.description")}</p>
          </div>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="rounded-xl bg-green-50 p-4 text-sm text-green-800">
            {t("settings.saved")}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Platform Settings */}
          {!settings ? (
            fetchError ? (
              <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                {fetchError.message}
              </p>
            ) : (
              <FormSkeleton fields={2} />
            )
          ) : (
            <form
              noValidate
              className="space-y-6 rounded-2xl border border-[#e4ecf2] bg-white p-5 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <div>
                <h2 className="mb-1 flex items-center gap-2 text-base font-extrabold text-[#00134c]">
                  <CalendarRange className="size-5 text-[#059ff8]" />
                  {t("settings.search.title")}
                </h2>
                <p className="mb-4 text-sm text-[#687886]">{t("settings.search.description")}</p>

                <label className="block text-sm">
                  <span className="mb-1.5 block font-bold text-[#334454]">
                    {t("settings.search.maxSearchDays")}
                  </span>
                  <Input
                    fieldName="maxSearchDays"
                    dir="ltr"
                    inputMode="numeric"
                    type="number"
                    min={1}
                    max={90}
                    className="max-w-40"
                    value={maxSearchDays}
                    onChange={(event) => {
                      setSaved(false);
                      setMaxSearchDays(event.target.value);
                    }}
                  />
                  <small className="mt-1 block text-xs text-[#687886]">
                    {t("settings.search.hint")}
                  </small>
                </label>
              </div>

              <div className="border-t border-[#e4ecf2] pt-5">
                <h2 className="mb-1 flex items-center gap-2 text-base font-extrabold text-[#00134c]">
                  <Users className="size-5 text-[#059ff8]" />
                  {t("settings.seats.title")}
                </h2>
                <p className="mb-4 text-sm text-[#687886]">{t("settings.seats.description")}</p>

                <label className="block text-sm">
                  <span className="mb-1.5 block font-bold text-[#334454]">
                    {t("settings.seats.maxSeats")}
                  </span>
                  <Input
                    fieldName="maxSeats"
                    dir="ltr"
                    inputMode="numeric"
                    type="number"
                    min={1}
                    max={50}
                    className="max-w-40"
                    value={maxSeats}
                    onChange={(event) => {
                      setSaved(false);
                      setMaxSeats(event.target.value);
                    }}
                  />
                  <small className="mt-1 block text-xs text-[#687886]">
                    {t("settings.seats.hint")}
                  </small>
                </label>
              </div>

              <div className="flex justify-end border-t border-[#e4ecf2] pt-4">
                <Button type="submit" loading={saving}>
                  {saving ? t("common.loading.saving") : t("common.actions.save")}
                </Button>
              </div>
            </form>
          )}

          {/* System Health & Status */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#e4ecf2] bg-white p-5 shadow-sm">
              <h2 className="mb-1 flex items-center gap-2 text-base font-extrabold text-[#00134c]">
                <Activity className="size-5 text-emerald-500" />
                {t("settings.health.title")}
              </h2>
              <p className="mb-4 text-sm text-[#687886]">
                {t("settings.health.description")}
              </p>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  {healthStatus === "ok" ? (
                    <CheckCircle2 className="size-6 text-emerald-500" />
                  ) : healthStatus === "down" ? (
                    <XCircle className="size-6 text-red-500" />
                  ) : (
                    <div className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-[#059ff8]" />
                  )}
                  <div>
                    <p className="font-bold text-slate-900 text-sm">
                      {healthStatus === "ok"
                        ? t("settings.health.connected")
                        : healthStatus === "down"
                          ? t("settings.health.failed")
                          : t("settings.health.checking")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t("settings.health.probePoint")} <code className="font-mono" dir="ltr">GET /health</code>
                    </p>
                  </div>
                </div>

                <span
                  className={`status-pill text-xs font-bold ${
                    healthStatus === "ok"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {healthStatus === "ok" ? t("settings.health.okStatus") : t("settings.health.downStatus")}
                </span>
              </div>
            </div>

            {/* Current Session */}
            {session && (
              <div className="rounded-2xl border border-[#e4ecf2] bg-white p-5 shadow-sm">
                <h2 className="mb-1 flex items-center gap-2 text-base font-extrabold text-[#00134c]">
                  <User className="size-5 text-[#059ff8]" />
                  {t("settings.session.title")}
                </h2>
                <p className="mb-4 text-sm text-[#687886]">
                  {t("settings.session.description")}
                </p>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                    <span className="text-xs font-bold text-slate-500">{t("settings.session.email")}</span>
                    <span className="font-mono text-xs font-bold text-slate-800" dir="ltr">
                      {session.email ?? "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                    <span className="text-xs font-bold text-slate-500">{t("settings.session.accessLevel")}</span>
                    <span className="text-xs font-bold text-[#059ff8]">
                      {session.appRole === "super_admin"
                        ? t("settings.session.superAdmin")
                        : session.appRole === "platform_staff"
                          ? t("settings.session.platformStaff")
                          : (session.appRole ?? t("settings.session.superAdmin"))}
                    </span>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={handleLogout}
                    >
                      <LogOut className="size-4" />
                      {t("settings.session.signOut")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ValidationScope>
  );
}
