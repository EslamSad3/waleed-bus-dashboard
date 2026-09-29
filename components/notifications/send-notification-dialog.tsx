"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  sendPlatformNotification,
  type SendNotificationInput,
} from "@/lib/actions/notifications";
import { fetchTargetOptions, type TargetOption } from "@/lib/actions/users";
import { fetchPromotions, type Promotion } from "@/lib/actions/promotions";
import { fetchTripsPage, type Trip } from "@/lib/actions/trips";
import { fetchFleetsPage } from "@/lib/actions/fleets";
import { useApiQuery, useDataQuery, qk } from "@/lib/queries";
import {
  AlertCircle,
  Send,
  Users,
  User,
  Search,
  CheckCircle2,
  X,
  Loader2,
} from "lucide-react";
import { t as tr } from "@/lib/i18n/t";
import { pushSummaryLines } from "@/lib/i18n/push-summary";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (message?: string) => void;
};

function matchesQuery(text: string | null | undefined, query: string): boolean {
  if (!text || !query) return false;
  return text.toLowerCase().includes(query.trim().toLowerCase());
}

function matchesPhone(phone: string | null | undefined, query: string): boolean {
  if (!phone || !query) return false;
  const cleanPhone = phone.replace(/\D/g, "");
  const cleanQuery = query.replace(/\D/g, "");
  if (!cleanQuery) return phone.toLowerCase().includes(query.toLowerCase());
  const strippedQuery = cleanQuery.replace(/^0+/, "");
  return (
    cleanPhone.includes(cleanQuery) ||
    phone.includes(query) ||
    (strippedQuery.length >= 2 && cleanPhone.includes(strippedQuery))
  );
}

/** Pending placeholder for the trip/promotion selects (same rounded control shape). */
function PendingSelectSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">{tr("common.loading.more")}</span>
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}

/** Pending placeholder for the user-picker results list (rows mirror the loaded rows). */
function PickerRowsSkeleton() {
  return (
    <div role="status" className="space-y-3 p-3">
      <span className="sr-only">{tr("common.loading.more")}</span>
      {Array.from({ length: 4 }, (_, row) => (
        <div key={row} className="flex items-center gap-2.5">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/3 max-w-full" />
            <Skeleton className="h-2.5 w-1/3 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SendNotificationDialog({ open, onOpenChange, onSuccess }: Props) {
  const [isGlobal, setIsGlobal] = useState(true);
  const [userId, setUserId] = useState("");
  const [selectedUserObj, setSelectedUserObj] = useState<TargetOption | null>(null);
  const [category, setCategory] = useState<"TEXT" | "TRIP" | "DISCOUNT_CODE">("TEXT");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tripId, setTripId] = useState("");
  const [promotionId, setPromotionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User search & options
  const [userOptions, setUserOptions] = useState<TargetOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  // False until the on-open user fetch settles once; drives the pending skeleton
  // in the picker (refetches on reopen stay silent, like before).
  const [usersSettled, setUsersSettled] = useState(false);
  const searchRequestId = useRef(0);

  // Promotions + trips load through TanStack cache (enabled by category),
  // so the pickers show skeletons while pending and cache on reopen.
  const { data: promoPage, isLoading: promotionsLoading } = useApiQuery(qk.promotions, () => fetchPromotions(), {
    enabled: open && category === "DISCOUNT_CODE",
  });
  const promotions = useMemo(
    () => (promoPage?.items ?? []).filter((promo) => promo.isActive),
    [promoPage],
  );
  const { data: tripsData, isLoading: tripsLoading } = useDataQuery<Trip[]>(
    ["notification-trips"],
    async () => {
      const fleetsRes = await fetchFleetsPage(null);
      if (!fleetsRes.ok) throw new Error(fleetsRes.message);
      const collected: Trip[] = [];
      for (const fleet of fleetsRes.data.items.slice(0, 5)) {
        const tRes = await fetchTripsPage(fleet.id, null);
        if (tRes.ok) collected.push(...tRes.data.items);
      }
      return collected;
    },
    { enabled: open && category === "TRIP" },
  );
  const trips = tripsData ?? [];

  // Load initial users when dialog opens
  useEffect(() => {
    if (!open) return;
    let active = true;
    fetchTargetOptions("").then((res) => {
      if (active && res.ok) setUserOptions(res.data);
    }).finally(() => {
      if (active) setUsersSettled(true);
    });
    return () => {
      active = false;
    };
  }, [open]);

  // Server-side debounced search when user types a query
  useEffect(() => {
    if (!open || isGlobal || !userSearch.trim()) return;
    const reqId = ++searchRequestId.current;
    const timer = setTimeout(() => {
      setLoadingUsers(true);
      fetchTargetOptions(userSearch).then((res) => {
        if (reqId !== searchRequestId.current) return;
        setLoadingUsers(false);
        if (res.ok) {
          setUserOptions((prev) => {
            const map = new Map<string, TargetOption>();
            for (const u of prev) map.set(u.id, u);
            for (const u of res.data) map.set(u.id, u);
            return Array.from(map.values());
          });
        }
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [open, isGlobal, userSearch]);

  // Client-side filtering for instantaneous responsiveness
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim();
    if (!q) return userOptions;
    return userOptions.filter(
      (u) =>
        matchesQuery(u.name, q) ||
        matchesPhone(u.phoneNumber, q) ||
        matchesQuery(u.email, q),
    );
  }, [userOptions, userSearch]);

  function resetForm() {
    setIsGlobal(true);
    setUserId("");
    setSelectedUserObj(null);
    setUserSearch("");
    setCategory("TEXT");
    setTitle("");
    setBody("");
    setTripId("");
    setPromotionId("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle) {
      setError(tr("notifications.send.errors.titleRequired"));
      return;
    }
    if (!trimmedBody) {
      setError(tr("notifications.send.errors.bodyRequired"));
      return;
    }

    let targetUserId = userId;
    // Auto-select if user typed and there is exactly 1 match
    if (!isGlobal && !targetUserId && filteredUsers.length === 1) {
      targetUserId = filteredUsers[0].id;
      setUserId(targetUserId);
      setSelectedUserObj(filteredUsers[0]);
    }

    if (!isGlobal && !targetUserId) {
      setError(tr("notifications.send.errors.targetRequired"));
      return;
    }
    if (category === "TRIP" && !tripId) {
      setError(tr("notifications.send.errors.tripRequired"));
      return;
    }
    if (category === "DISCOUNT_CODE" && !promotionId) {
      setError(tr("notifications.send.errors.promoRequired"));
      return;
    }

    setSubmitting(true);

    const payload: SendNotificationInput = {
      isGlobal,
      userId: isGlobal ? undefined : targetUserId,
      category,
      title: trimmedTitle,
      body: trimmedBody,
      tripId: category === "TRIP" ? tripId : undefined,
      promotionId: category === "DISCOUNT_CODE" ? promotionId : undefined,
    };

    const res = await sendPlatformNotification(payload);
    setSubmitting(false);

    if (res.ok) {
      const headline = res.data.isGlobal
        ? tr("notifications.send.successGlobal", { value: res.data.sentCount })
        : tr("notifications.send.successDirect");
      // Inbox rows and Firebase acceptance are reported as separate lines so
      // the operator never reads "saved" as "delivered".
      const detail = pushSummaryLines(res.data.push, res.data.sentCount).join(" ");
      resetForm();
      onOpenChange(false);
      onSuccess(detail ? `${headline} ${detail}` : headline);
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
      title={tr("notifications.send.title")}
      description={tr("notifications.send.description")}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
          >
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Target Mode Toggle */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#00134c]">{tr("notifications.send.targetsLabel")}</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setIsGlobal(true)}
              className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-colors ${
                isGlobal
                  ? "border-[#059ff8] bg-[#d6eeff] text-[#00134c]"
                  : "border-[#d7e1ea] bg-white text-[#5e6b78] hover:bg-slate-50"
              }`}
            >
              <Users className="size-4" />
              <span>{tr("notifications.send.audienceAll")}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsGlobal(false)}
              className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-colors ${
                !isGlobal
                  ? "border-[#059ff8] bg-[#d6eeff] text-[#00134c]"
                  : "border-[#d7e1ea] bg-white text-[#5e6b78] hover:bg-slate-50"
              }`}
            >
              <User className="size-4" />
              <span>{tr("notifications.send.audienceSpecific")}</span>
            </button>
          </div>
        </div>

        {/* User Selection (NO UUID, Searchable Autocomplete Picker) */}
        {!isGlobal && (
          <div className="space-y-2 rounded-xl border border-[#d6eeff] bg-[#f8fbfd] p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#00134c]">
                {tr("notifications.send.pickUserLabel")}
              </label>
              {userId && (
                <span className="text-[11px] font-semibold text-emerald-700">
                  {tr("notifications.send.userSelected")}
                </span>
              )}
            </div>

            {selectedUserObj ? (
              /* Selected User Card */
              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50/80 p-3 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-emerald-950">
                      {selectedUserObj.name || tr("notifications.fallbackUserWithoutName")}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-emerald-800">
                      {selectedUserObj.phoneNumber && (
                        <span dir="ltr" className="font-semibold">
                          {selectedUserObj.phoneNumber}
                        </span>
                      )}
                      {selectedUserObj.email && (
                        <span dir="ltr" className="text-emerald-700">
                          {selectedUserObj.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setUserId("");
                    setSelectedUserObj(null);
                    setUserSearch("");
                  }}
                  className="shrink-0 gap-1 border-emerald-200 text-xs text-emerald-900 hover:bg-emerald-100"
                >
                  <X className="size-3.5" />
                  <span>{tr("common.actions.change")}</span>
                </Button>
              </div>
            ) : (
              /* Search Input and Live Interactive Results List */
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    placeholder={tr("notifications.placeholders.userSearch")}
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (filteredUsers.length > 0) {
                          const picked = filteredUsers[0];
                          setUserId(picked.id);
                          setSelectedUserObj(picked);
                          setUserSearch("");
                        }
                      }
                    }}
                    className="text-xs pe-8"
                    autoFocus
                  />
                  <div className="absolute end-2.5 top-2.5 flex items-center gap-1 text-[#5e6b78]">
                    {loadingUsers ? (
                      <Loader2 className="size-3.5 animate-spin text-[#059ff8]" />
                    ) : (
                      <Search className="size-3.5 pointer-events-none" />
                    )}
                  </div>
                </div>

                {/* Results dropdown list */}
                <div className="max-h-48 overflow-y-auto rounded-xl border border-[#d7e1ea] bg-white divide-y divide-[#f0f4f8] shadow-inner">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => {
                          setUserId(u.id);
                          setSelectedUserObj(u);
                          setUserSearch("");
                        }}
                        className="flex w-full items-center justify-between gap-3 p-2.5 text-right transition-colors hover:bg-[#d6eeff]/40"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#d6eeff] text-[#00134c]">
                            <User className="size-3.5" />
                          </div>
                          <div className="min-w-0 text-right">
                            <div className="truncate text-xs font-bold text-[#00134c]">
                              {u.name || tr("notifications.fallbackUserWithoutName")}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5e6b78]">
                              {u.phoneNumber && <span dir="ltr">{u.phoneNumber}</span>}
                              {u.email && <span dir="ltr">— {u.email}</span>}
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-lg bg-[#d6eeff] px-2 py-0.5 text-[11px] font-bold text-[#00134c]">
                          {tr("common.actions.select")}
                        </span>
                      </button>
                    ))
                  ) : loadingUsers ? (
                    <div className="flex items-center justify-center gap-2 p-4 text-xs text-slate-500">
                      <Loader2 className="size-4 animate-spin text-[#059ff8]" />
                      <span>{tr("common.loading.searching")}</span>
                    </div>
                  ) : !usersSettled ? (
                    <PickerRowsSkeleton />
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">
                      {userSearch.trim()
                        ? tr("notifications.send.noUserMatch", { userSearch: userSearch })
                        : tr("notifications.send.noUsers")}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-[#5e6b78]">
                  {userSearch.trim()
                    ? tr("notifications.send.keyboardHint", { filteredUsersLength: filteredUsers.length })
                    : tr("notifications.send.noUserSelectedHint", { filteredUsersLength: filteredUsers.length })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Category select */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#00134c]">{tr("notifications.send.typeLabel")}</label>
          <select
            className="w-full rounded-xl border border-[#d7e1ea] bg-white p-2.5 text-sm outline-none focus:border-[#059ff8] focus:ring-1 focus:ring-[#059ff8]"
            value={category}
            onChange={(e) => setCategory(e.target.value as "TEXT" | "TRIP" | "DISCOUNT_CODE")}
          >
            <option value="TEXT">{tr("notifications.send.typeText")}</option>
            <option value="TRIP">{tr("notifications.send.typeTrip")}</option>
            <option value="DISCOUNT_CODE">{tr("notifications.send.typePromo")}</option>
          </select>
        </div>

        {/* Trip Dropdown if TRIP (NO UUID) */}
        {category === "TRIP" && (
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#00134c]">{tr("notifications.send.pickTripLabel")}</label>
            {tripsLoading ? (
              <PendingSelectSkeleton />
            ) : (
              <>
                <select
                  className="w-full rounded-xl border border-[#d7e1ea] bg-white p-2.5 text-sm outline-none focus:border-[#059ff8] focus:ring-1 focus:ring-[#059ff8]"
                  value={tripId}
                  onChange={(e) => setTripId(e.target.value)}
                >
                  <option value="">{tr("notifications.send.pickTripOption")}</option>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.origin} ← {t.destination} ({new Date(t.departAt).toLocaleString("ar-EG")})
                    </option>
                  ))}
                </select>
                {trips.length === 0 && (
                  <p className="text-[11px] text-amber-700">{tr("notifications.send.noTrips")}</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Promotion Dropdown if DISCOUNT_CODE (NO UUID) */}
        {category === "DISCOUNT_CODE" && (
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#00134c]">{tr("notifications.send.pickPromoLabel")}</label>
            {promotionsLoading ? (
              <PendingSelectSkeleton />
            ) : (
              <>
                <select
                  className="w-full rounded-xl border border-[#d7e1ea] bg-white p-2.5 text-sm outline-none focus:border-[#059ff8] focus:ring-1 focus:ring-[#059ff8]"
                  value={promotionId}
                  onChange={(e) => setPromotionId(e.target.value)}
                >
                  <option value="">{tr("notifications.send.pickPromoOption")}</option>
                  {promotions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} {tr("notifications.send.promoDiscountPrefix")} {p.value} {tr("promotions.columns.discountUnitPrefix")}{p.isGlobal ? tr("promotions.placeholders.promoGlobal") : tr("promotions.placeholders.promoSpecific")})
                    </option>
                  ))}
                </select>
                {promotions.length === 0 && (
                  <p className="text-[11px] text-amber-700">{tr("notifications.send.noPromos")}</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Title */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#00134c]">{tr("notifications.send.titleLabel")}</label>
          <Input
            placeholder={tr("notifications.placeholders.title")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>

        {/* Body */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#00134c]">{tr("notifications.send.bodyLabel")}</label>
          <textarea
            rows={4}
            placeholder={tr("notifications.placeholders.body")}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            className="w-full rounded-xl border border-[#d7e1ea] bg-white p-2.5 text-sm outline-none focus:border-[#059ff8] focus:ring-1 focus:ring-[#059ff8]"
          />
          <p className="text-left text-[11px] text-[#5e6b78]" dir="ltr">
            {body.length} / 2000
          </p>
        </div>

        {/* Dialog Actions */}
        <div className="flex flex-col-reverse gap-2 border-t border-[#e4ecf2] pt-3 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {tr("common.actions.cancel")}
          </Button>
          <Button
            type="submit"
            loading={submitting}
            className="gap-2 bg-[#059ff8] hover:bg-[#00134c]"
          >
            <Send className="size-4" />
            <span>{submitting ? tr("common.loading.sending") : tr("notifications.send.submit")}</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
