"use client";

import { Select } from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { fetchBusesPage, type Bus } from "@/lib/actions/buses";
import { t } from "@/lib/i18n/t";

export type BusChoice = {
  id: string;
  label: string;
  searchText: string;
};

/**
 * Owner-scoped active-bus picker (the mirror of `DriverPicker`).
 *
 * Walks the real cursor until it is exhausted, searches the loaded choices,
 * and retains the selection across searches. Only active buses are offered;
 * final eligibility stays backend-enforced.
 */
export function BusPicker({
  ownerId,
  value,
  onChange,
}: {
  ownerId: string;
  /** Selected bus id. */
  value: string;
  onChange: (busId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Bus[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fresh scope, fresh choices in render phase (no setState-in-effect).
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
    void fetchBusesPage(ownerId, null).then((result) => {
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
    const result = await fetchBusesPage(ownerId, cursor);
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

  const choices = useMemo<BusChoice[]>(
    () =>
      rows
        .filter((row) => row.isActive)
        .map((row) => {
          const plate = row.plateNumber ?? row.registrationNumber;
          return {
            id: row.id,
            label: plate,
            searchText: `${row.plateNumber ?? ""} ${row.registrationNumber ?? ""}`,
          };
        }),
    [rows],
  );

  const needle = query.trim();
  const visible = useMemo(
    () => (needle ? choices.filter((choice) => choice.searchText.includes(needle)) : choices),
    [choices, needle],
  );

  const knownLabels = useMemo(() => new Map(choices.map((choice) => [choice.id, choice.label] as const)), [choices]);
  const selectedOutside = Boolean(value) && !choices.some((choice) => choice.id === value);

  return (
    <div>
      <label className="block text-sm">
        <span className="mb-1.5 block font-bold text-[#334454]">{t("drivers.assignBus.busLabel")}</span>
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("drivers.assignBus.searchPlaceholder")}
          aria-label={t("drivers.assignBus.searchAria")}
          className="mb-2"
        />
      </label>
      {!started ? (
        <p role="status" className="text-sm text-[#6b7c8c]">{t("drivers.assignBus.loading")}</p>
      ) : loadError && rows.length === 0 ? (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
      ) : (
        <Select fieldName="busId"
          aria-label={t("drivers.assignBus.busLabel")}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="select-field w-full"
        >
          <option value="">{t("drivers.assignBus.searchPlaceholder")}</option>
          {selectedOutside ? (
            <option value={value} disabled>
              {knownLabels.get(value) ?? value.slice(0, 8)}
            </option>
          ) : null}
          {visible.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.label}
            </option>
          ))}
        </Select>
      )}
      {loadError && rows.length > 0 ? (
        <p role="alert" className="mt-1.5 text-xs text-red-600">{loadError}</p>
      ) : null}
      {!started || visible.length > 0 || needle ? null : (
        <p className="mt-1.5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{t("drivers.assignBus.empty")}</p>
      )}
      {cursor ? (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="mt-2 text-xs font-bold text-[#1f6f8b] underline disabled:opacity-60"
        >
          {loadingMore ? t("drivers.assignBus.loadingMore") : t("drivers.assignBus.loadMore")}
        </button>
      ) : null}
      {started && rows.length > 0 ? (
        <p className="mt-1.5 text-xs text-[#6b7c8c]">{t("drivers.assignBus.resultCount", { count: visible.length })}</p>
      ) : null}
    </div>
  );
}
