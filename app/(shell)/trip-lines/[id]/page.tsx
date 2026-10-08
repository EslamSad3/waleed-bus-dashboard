"use client";

import { use, useEffect, useState } from "react";
import { MapPin, Pencil, Route, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { OwnerPicker } from "@/components/owners/owner-picker";
import { EditTripLineDialog } from "@/components/trip-lines/edit-trip-line-dialog";
import {
  deleteOwnerTripLine,
  fetchOwnerTripLine,
  lineEndpoints,
  updateOwnerTripLine,
  type TripLine,
} from "@/lib/actions/trip-lines";
import { setOwnerScopeCookie } from "@/lib/owner-scope-cookie";
import { qk, patchDetail, useApiQuery, useQueryClient } from "@/lib/queries";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
import { t } from "@/lib/i18n/t";

/**
 * A line is ONE direction: there is no direction toggle and no route/direction
 * split any more. The single ordered stop list IS the route, and its first and
 * last stop are what every trip on this line reports as origin/destination.
 */
type StopUse = "BOARDING" | "LANDING";

const stopUseLabels: Record<StopUse, string> = {
  BOARDING: t("enums.stopUse.boarding"),
  LANDING: t("enums.stopUse.landing"),
};

export default function TripLineDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ownerId?: string }>;
}) {
  const { id } = use(params);
  const { ownerId: scopeOwnerId } = use(searchParams);
  const router = useRouter();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [ownerId, setOwnerId] = useState(scopeOwnerId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const { data: line, error: lineError } = useApiQuery<TripLine>(
    qk.tripLine(ownerId, id),
    () => fetchOwnerTripLine(ownerId, id),
    { enabled: Boolean(ownerId) },
  );

  useEffect(() => {
    if (!ownerId) return;
    setOwnerScopeCookie(ownerId);
  }, [ownerId]);

  async function toggle() {
    if (!line) return;
    const result = await updateOwnerTripLine(ownerId, id, { isActive: !line.isActive });
    if (!result.ok) return setError(result.message);
    patchDetail(queryClient, qk.tripLine(ownerId, id), result.data);
  }

  async function remove() {
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("tripLines.detail.deleteConfirm.description"), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deleteOwnerTripLine(ownerId, id);
    if (!result.ok) return setError(result.message);
    router.push("/trip-lines");
    router.refresh();
  }

  if (!ownerId) {
    return (
      <div className="dashboard-page max-w-xl">
        <div>
          <h1 className="page-title">{t("tripLines.detail.title")}</h1>
          <p className="page-description">{t("tripLines.detail.pickOwnerDescription")}</p>
        </div>
        <div className="panel-card p-5 sm:p-6">
          <OwnerPicker ownerId="" onOwnerChange={(next) => setOwnerId(next)} />
        </div>
      </div>
    );
  }
  if (lineError && !line) return <p role="alert" className="text-sm text-red-600">{lineError.message}</p>;
  if (!line) return <DetailPageSkeleton />;


  const ordered = [...line.stops].sort((a, b) => a.stopOrder - b.stopOrder);
  const { origin, destination } = lineEndpoints(line);

  return (
    <div className="dashboard-page space-y-5">
      <div className="page-heading gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${line.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {line.isActive ? t("tripLines.activeBadge") : t("tripLines.inactiveBadge")}
            </span>
            {line.code ? <span dir="auto" className="rounded-full bg-[#eaf4fa] px-3 py-1 text-xs font-extrabold text-[#285778]">{line.code}</span> : null}
          </div>
          <h1 className="page-title">{line.name}</h1>
          <p className="page-description">{t("tripLines.detail.description")}</p>
        </div>
        <div className="flex flex-wrap gap-2 max-md:w-full">
          <AsyncButton variant="secondary" className="max-md:w-full" onClick={toggle}>
            {line.isActive ? t("tripLines.detail.actions.disableLine") : t("tripLines.detail.actions.enable")}
          </AsyncButton>
          <Button className="max-md:w-full" onClick={() => setEditing(true)}><Pencil className="size-4" /> {t("tripLines.detail.actions.editMeta")}</Button>
          <AsyncButton variant="destructive" className="max-md:w-full" onClick={remove}><Trash2 className="size-4" /> {t("tripLines.detail.actions.deleteLine")}</AsyncButton>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="overflow-hidden rounded-[1.5rem] border border-[#cfe1ec] bg-gradient-to-br from-[#eaf6ff] via-white to-[#fff7e3]/60">
        <div className="flex flex-col gap-3 border-b border-[#dce8ef] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-2 text-[#00134c]">
            <Route className="size-5 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-extrabold">{t("tripLines.detail.routeTitle")}</h2>
              <p className="mt-0.5 text-xs text-[#687886]">{t("tripLines.detail.routeHint")}</p>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          {ordered.length ? (
            <ol className="space-y-0">
              {ordered.map((item, index) => (
                <li key={item.id} className="flex gap-3">
                  <div className="flex w-8 shrink-0 flex-col items-center">
                    <span className={`grid size-8 place-items-center rounded-full text-xs font-extrabold ${index === 0 ? "bg-[#00134c] text-white" : index === ordered.length - 1 ? "bg-[#059ff8] text-white" : "bg-[#d6eeff] text-[#00134c]"}`}>{index + 1}</span>
                    {index < ordered.length - 1 && <span className="my-1 min-h-5 flex-1 border-r-2 border-dashed border-[#9dc2da]" />}
                  </div>
                  <div className="mb-2 flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-[#dbe7ee]">
                    <MapPin className="size-4 shrink-0 text-[#059ff8]" />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm">{item.station.name}</strong>
                      <small className="block truncate text-xs text-[#687886]">{item.station.address || item.station.governorate?.nameAr}</small>
                    </span>
                    <span className="shrink-0 rounded-full bg-[#eaf4fa] px-2.5 py-1 text-xs font-bold text-[#285778]">
                      {stopUseLabels[item.stopType]}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#b9d2e3] bg-white/70 px-5 py-9 text-center">
              <MapPin className="mx-auto mb-2 size-7 text-[#059ff8]" />
              <p className="font-bold text-[#334454]">{t("tripLines.detail.stopsEmpty")}</p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl bg-[#00134c] p-4 text-white sm:grid-cols-2">
        <p>
          <span className="text-xs text-[#9ed0f0]">{t("common.fields.origin")}</span>
          <br />
          <strong>{origin ?? t("tripLines.incomplete")}</strong>
        </p>
        <p>
          <span className="text-xs text-[#9ed0f0]">{t("common.fields.destination")}</span>
          <br />
          <strong>{destination ?? t("tripLines.incomplete")}</strong>
        </p>
      </section>

      <EditTripLineDialog line={editing ? line : null} onClose={() => setEditing(false)} />
    </div>
  );
}
