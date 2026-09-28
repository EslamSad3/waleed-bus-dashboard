"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { CursorList } from "@/components/tables/cursor-list";
import type { CommunityColumnDef } from "@/components/tables/ag-grid-types";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeletons";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  createPromotion,
  deletePromotion,
  expirePromotion,
  fetchPromotions,
  fetchPromotionUsages,
  updatePromotion,
  type Promotion,
  type PromotionUsage,
} from "@/lib/actions/promotions";
import { fetchTargetOptions, type TargetOption } from "@/lib/actions/users";
import { qk, removeFromCursorList, upsertInCursorList, useApiQuery, useQueryClient } from "@/lib/queries";
import { t } from "@/lib/i18n/t";

export default function PromotionsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: promoPage, isLoading, error: fetchError } = useApiQuery(qk.promotions, fetchPromotions);
  const rows: Promotion[] | null = promoPage?.items ?? null;
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [usagesFor, setUsagesFor] = useState<Promotion | null>(null);
  const [usages, setUsages] = useState<PromotionUsage[] | null>(null);
  const [code, setCode] = useState("");
  const [value, setValue] = useState("");
  const [audience, setAudience] = useState<"all" | "specific">("all");
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [userOptions, setUserOptions] = useState<TargetOption[]>([]);
  const [userOptionsLoading, setUserOptionsLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [maxTotal, setMaxTotal] = useState("");
  const [maxPerUser, setMaxPerUser] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");

  function openCreate() {
    setEditing(null);
    setCode("");
    setValue("");
    setAudience("all");
    setTargetIds([]);
    setUserSearch("");
    setMaxTotal("");
    setMaxPerUser("1");
    setExpiresAt("");
    setError(null);
    setCreating(true);
  }

  function openEdit(promo: Promotion) {
    setCreating(false);
    setEditing(promo);
    setValue(promo.value);
    setAudience(promo.isGlobal ? "all" : "specific");
    setTargetIds(promo.targetUserIds ?? []);
    setUserSearch("");
    setMaxTotal(promo.maxTotalUses != null ? String(promo.maxTotalUses) : "");
    setMaxPerUser(String(promo.maxUsesPerUser));
    setExpiresAt(promo.expiresAt ? promo.expiresAt.slice(0, 16) : "");
    setError(null);
  }

  async function save() {
    const numValue = Number(value);
    if (!editing && !code.trim()) {
      setError(t("promotions.errors.codeRequired"));
      return;
    }
    if (!Number.isFinite(numValue) || numValue <= 0) {
      setError(t("promotions.errors.valueRequired"));
      return;
    }
    const specific = editing ? !editing.isGlobal : audience === "specific";
    if (specific && targetIds.length === 0) {
      setError(t("promotions.errors.usersRequired"));
      return;
    }
    const result = editing
      ? await updatePromotion(editing.id, {
          value: numValue,
          ...(!editing.isGlobal ? { targetUserIds: targetIds } : {}),
          maxUsesPerUser: Number(maxPerUser) || 1,
          maxTotalUses: maxTotal ? Number(maxTotal) : null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        })
      : await createPromotion({
          code: code.trim(),
          type: "FIXED",
          value: numValue,
          isGlobal: audience === "all",
          ...(audience === "specific" ? { targetUserIds: targetIds } : {}),
          maxUsesPerUser: Number(maxPerUser) || 1,
          maxTotalUses: maxTotal ? Number(maxTotal) : undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        });
    if (!result.ok) return setError(result.message);
    upsertInCursorList(queryClient, qk.promotions, result.data);
    setEditing(null);
    setCreating(false);
    setError(null);
  }

  async function expire(promo: Promotion) {
    const result = await expirePromotion(promo.id);
    if (!result.ok) return setError(result.message);
    upsertInCursorList(queryClient, qk.promotions, result.data);
  }

  async function removePromo(promo: Promotion) {
    if (!(await confirm({ title: t("common.actions.deleteConfirmTitle"), description: t("promotions.deleteConfirm.description", { promoCode: promo.code }), confirmLabel: t("common.actions.delete"), destructive: true }))) return;
    const result = await deletePromotion(promo.id);
    if (!result.ok) return setError(result.message);
    removeFromCursorList<Promotion>(queryClient, qk.promotions, promo.id);
  }

  async function openUsages(promo: Promotion) {
    setUsagesFor(promo);
    setUsages(null);
    const result = await fetchPromotionUsages(promo.id);
    if (result.ok) { setUsages(result.data.items); setError(null); }
    else setError(result.message);
  }

  const dialogOpen = creating || editing !== null;
  // Monotonic request id: drops stale search responses when a newer query
  // overtakes an older one (no AbortController in the shared http layer).
  const targetSearchId = useRef(0);

  useEffect(() => {
    if (!dialogOpen) return;
    // Server-side search over ALL eligible accounts (debounced); the list is
    // already scoped to active passengers by GET /users/target-options.
    const timer = setTimeout(() => {
      const requestId = ++targetSearchId.current;
      setUserOptionsLoading(true);
      fetchTargetOptions(userSearch).then((result) => {
        if (requestId !== targetSearchId.current) return;
        setUserOptionsLoading(false);
        if (result.ok) setUserOptions(result.data);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [dialogOpen, userSearch]);

  const columns: CommunityColumnDef<Promotion>[] = [
    {
      field: "code",
      headerName: t("common.fields.code"),
      cellRenderer: (params: { data?: Promotion }) => params.data ? <span dir="ltr" className="font-mono font-bold">{params.data.code}<span className={params.data.isActive ? "ms-2 status-pill" : "ms-2 status-pill status-pill-muted"}>{params.data.isActive ? t("common.status.active") : t("common.status.inactive")}</span></span> : null,
    },
    {
      field: "type",
      headerName: t("common.fields.type"),
      cellRenderer: (params: { data?: Promotion }) => params.data ? <span>{params.data.value} {t("promotions.columns.fixedValue")}</span> : null,
    },
    { field: "maxUsesPerUser", headerName: t("promotions.columns.maxUsesPerUser"), filter: "agNumberColumnFilter" },
    {
      field: "isGlobal",
      headerName: t("promotions.columns.scope"),
      cellRenderer: (params: { data?: Promotion }) => params.data ? (
        <span>{params.data.isGlobal ? t("promotions.scopeGlobal") : t("promotions.scopeSpecific", { value: params.data.targetUserIds?.length ?? 0 })}</span>
      ) : null,
    },
    {
      field: "maxTotalUses",
      headerName: t("promotions.columns.maxTotalUses"),
      cellRenderer: (params: { data?: Promotion }) => <span>{params.data?.maxTotalUses ?? "∞"}</span>,
    },
    // Shared actions column shape — three-dots menu like every other table.
    {
      headerName: t("promotions.columns.actions"),
      pinned: "right" as const,
      sortable: false,
      filter: false,
      exportable: false,
      cellRenderer: (params: { data?: Promotion }) => params.data ? (
        <RowActionsMenu
          label={t("promotions.list.rowActions", { value: params.data.code })}
          actions={[
            { label: t("common.actions.edit"), onSelect: () => openEdit(params.data!) },
            { label: t("promotions.actions.usages"), onSelect: () => void openUsages(params.data!) },
            ...(params.data.isActive ? [{ label: t("common.actions.disable"), onSelect: () => void expire(params.data!) }] : []),
            { label: t("common.actions.delete"), danger: true, onSelect: () => void removePromo(params.data!) },
          ]}
        />
      ) : null,
    },
];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t("promotions.title")}</h1>
          <p className="page-description">{t("promotions.description")}</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> {t("promotions.newCode")}</Button>
      </div>
      {error && !dialogOpen && !usagesFor ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {fetchError ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{fetchError.message}</p> : null}
      {isLoading ? <TableSkeleton rows={8} columns={6} /> : (
        <CursorList<Promotion>
          gridId="promotions"
          withActions={false}
          initialItems={rows ?? []}
          initialCursor={null}
          loadMore={async () => ({ items: [], nextCursor: null })}
          keyOf={(promo) => promo.id}
          columnDefs={columns}
          emptyMessage={t("promotions.empty")}
        />
      )}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setCreating(false); setEditing(null); setError(null); } }} title={editing ? t("promotions.dialog.editTitle", { editingCode: editing.code }) : t("promotions.dialog.createTitle")} description={editing ? t("promotions.dialog.immutableHint") : t("promotions.dialog.codeHint")} size="sm">
        <div className="space-y-4">
          {!editing ? <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("common.fields.code")}</span><Input dir="ltr" value={code} onChange={(event) => setCode(event.target.value)} placeholder="SAVE10" /></label> : null}
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("promotions.dialog.valueLabel")}</span><Input dir="ltr" inputMode="decimal" type="number" min={1} value={value} onChange={(event) => setValue(event.target.value)} placeholder={t("promotions.placeholders.value")} /></label>
          {!editing || !editing.isGlobal ? (
            <div className="space-y-2 text-sm">
              <span className="block font-bold text-[#334454]">{t("promotions.dialog.audienceLabel")} {editing ? t("promotions.dialog.scopeImmutable") : ""}</span>
              {!editing ? (
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2"><input type="radio" checked={audience === "all"} onChange={() => setAudience("all")} className="size-4 accent-[#059ff8]" /> {t("promotions.audience.all")}</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={audience === "specific"} onChange={() => setAudience("specific")} className="size-4 accent-[#059ff8]" /> {t("promotions.audience.specific")}</label>
                </div>
              ) : null}
              {(editing ? !editing.isGlobal : audience === "specific") ? (
                <div className="rounded-xl border border-[#e4ecf2] p-3">
                  <Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder={t("promotions.placeholders.userSearch")} />
                  <p className="mt-1 text-xs text-slate-500">{t("promotions.dialog.searchHint")}</p>
                  <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                    {userOptionsLoading ? (
                      <div role="status" className="space-y-1">
                        <span className="sr-only">{t("common.loading.more")}</span>
                        {Array.from({ length: 3 }, (_, index) => (
                          <Skeleton key={index} className="h-9 w-full rounded-lg" />
                        ))}
                      </div>
                    ) : userOptions
                      .map((u) => (
                        <label key={u.id} className="flex min-w-0 items-center gap-2 rounded-lg bg-[#f8fbfd] p-2">
                          <input
                            type="checkbox"
                            checked={targetIds.includes(u.id)}
                            onChange={(event) =>
                              setTargetIds((ids) => (event.target.checked ? [...ids, u.id] : ids.filter((id) => id !== u.id)))
                            }
                            className="size-4 shrink-0 accent-[#059ff8]"
                          />
                          <span className="min-w-0 truncate font-bold">{u.name ?? t("common.value.withoutName")}</span>
                          <span dir="ltr" className="shrink-0 text-xs text-slate-500">{u.phoneNumber ?? ""}</span>
                        </label>
                      ))}
                  </div>
                  <p className="mt-1 text-xs font-bold text-[#059ff8]">{t("promotions.dialog.selectedCountLabel")} {targetIds.length}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("promotions.dialog.maxPerUser")}</span><Input dir="ltr" inputMode="numeric" type="number" min={1} value={maxPerUser} onChange={(event) => setMaxPerUser(event.target.value)} /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("promotions.dialog.maxTotal")}</span><Input dir="ltr" inputMode="numeric" type="number" min={1} value={maxTotal} onChange={(event) => setMaxTotal(event.target.value)} /></label>
          <label className="block text-sm"><span className="mb-1.5 block font-bold text-[#334454]">{t("promotions.dialog.expiresAt")}</span><Input dir="ltr" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2 border-t border-[#e4ecf2] pt-4"><Button type="button" variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>{t("common.actions.cancel")}</Button><AsyncButton type="button" onClick={save}>{t("common.actions.save")}</AsyncButton></div>
        </div>
      </Dialog>
      <Dialog open={usagesFor !== null} onOpenChange={(open) => { if (!open) setUsagesFor(null); }} title={usagesFor ? t("promotions.usagesDialog.title", { usagesForCode: usagesFor.code }) : t("promotions.usagesDialog.subtitle")} description={t("promotions.usagesDialog.description")} size="sm">
        <div className="space-y-2 text-sm">
          {!usages ? <p className="text-slate-500">{t("common.loading.more")}</p> : usages.length === 0 ? <p className="text-slate-500">{t("promotions.usagesDialog.empty")}</p> : usages.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-xl bg-[#f8fbfd] p-3">
              <span dir="ltr" className="font-mono text-xs text-slate-500">{u.bookingId.slice(0, 8)}…</span>
              <span className="font-bold">{u.discountAmount} {t("promotions.columns.discountAmountUnit")}</span>
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
