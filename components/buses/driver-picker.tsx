"use client";

import { Select } from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { fetchDriversPage, type DriverRow } from "@/lib/actions/members";
import { t } from "@/lib/i18n/t";

export type DriverChoice = {
  userId: string;
  label: string;
  searchText: string;
};

/**
 * Owner-scoped driver picker for eligible drivers only: an ACTIVE membership
 * whose user account is active. The owner's own self-membership row shows up
 * in its own fleet's picker.
 *
 * Pages the real cursor until the API returns no next cursor (never a
 * first-page or fixed-page cutoff), searches over the LOADED choices, and
 * keeps a chosen driver selected even when a new search hides it. Final
 * eligibility stays backend-enforced. A driver may drive several buses at
 * once, so no "assigned elsewhere" marker is shown.
 */
export function DriverPicker({
  ownerId,
  value,
  onChange,
}: {
  ownerId: string;
  /** Selected driver user id. */
  value: string;
  onChange: (driverUserId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fresh scope, fresh choices: changing the company discards the old roster
  // in render phase (no setState-in-effect); the fetch below only resolves.
  const [scope, setScope] = useState(ownerId);
  if (scope !== ownerId) {
    setScope(ownerId);
    setRows([]);
    setCursor(null);
    setStarted(false);
    setLoadError(null);
  }
  useEffect(() => {
    let cancelled = false;
    void fetchDriversPage(ownerId, null).then((result) => {
      if (cancelled) return;
      setStarted(true);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setRows(result.data.items);
      setCursor(result.data.nextCursor);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    const result = await fetchDriversPage(ownerId, cursor);
    setLoadingMore(false);
    if (!result.ok) {
      setLoadError(result.message);
      return;
    }
    setRows((current) => {
      const seen = new Set(current.map((row) => row.id));
      return [...current, ...result.data.items.filter((row) => !seen.has(row.id))];
    });
    setCursor(result.data.nextCursor);
  }

  const choices = useMemo<DriverChoice[]>(
    () =>
      rows
        // Eligible drivers only: ACTIVE membership AND an active user account
        // (the owner's own self-membership row is eligible in its own fleet).
        .filter((row) => row.status === "ACTIVE" && row.isActive)
        .map((row) => {
          const userId = row.userId ?? row.id;
          const name = row.name || row.nickname || row.phoneNumber || userId.slice(0, 8);
          return {
            userId,
            label: row.phoneNumber ? `${name} · ${row.phoneNumber}` : name,
            searchText: `${row.name ?? ""} ${row.nickname ?? ""} ${row.phoneNumber ?? ""}`,
          };
        }),
    [rows],
  );

  const needle = query.trim();
  const visible = useMemo(
    () => (needle ? choices.filter((choice) => choice.searchText.includes(needle)) : choices),
    [choices, needle],
  );

  // A choice the operator already made must survive a new search that hides it.
  const knownLabels = useMemo(() => new Map(choices.map((choice) => [choice.userId, choice.label] as const)), [choices]);
  const selectedOutside = Boolean(value) && !choices.some((choice) => choice.userId === value);

  return (
    <div>
      <label className="block text-sm">
        <span className="mb-1.5 block font-bold text-[#334454]">{t("buses.assign.driverLabel")}</span>
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("buses.assign.searchPlaceholder")}
          aria-label={t("buses.assign.searchAria")}
          className="mb-2"
        />
      </label>
      {!started ? (
        <p role="status" className="text-sm text-[#6b7c8c]">{t("buses.assign.loading")}</p>
      ) : loadError && rows.length === 0 ? (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
      ) : (
        <Select fieldName="driverUserId"
          aria-label={t("buses.assign.driverLabel")}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="select-field w-full"
        >
          <option value="">{t("buses.detail.pickDriverOption")}</option>
          {selectedOutside ? (
            <option value={value} disabled>
              {knownLabels.get(value) ?? value.slice(0, 8)}
            </option>
          ) : null}
          {visible.map((choice) => (
            <option key={choice.userId} value={choice.userId}>
              {choice.label}
            </option>
          ))}
        </Select>
      )}
      {loadError && rows.length > 0 ? (
        <p role="alert" className="mt-1.5 text-xs text-red-600">{loadError}</p>
      ) : null}
      {!started || visible.length > 0 || needle ? null : (
        <p className="mt-1.5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{t("buses.assign.empty")}</p>
      )}
      {cursor ? (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="mt-2 text-xs font-bold text-[#1f6f8b] underline disabled:opacity-60"
        >
          {loadingMore ? t("buses.assign.loadingMore") : t("buses.assign.loadMore")}
        </button>
      ) : null}
      {started && rows.length > 0 ? (
        <p className="mt-1.5 text-xs text-[#6b7c8c]">{t("buses.assign.resultCount", { count: visible.length })}</p>
      ) : null}
    </div>
  );
}
