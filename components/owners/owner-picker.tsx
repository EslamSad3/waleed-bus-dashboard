"use client";

import { useEffect, useMemo, useState } from "react";
import { useApiQuery, qk } from "@/lib/queries";
import { fetchOwnerOptions, type OwnerOption } from "@/lib/actions/fleet-owners";
import { t } from "@/lib/i18n/t";

const DEBOUNCE_MS = 300;

/**
 * Searchable owner picker.
 *
 * An owner user IS the company, so there is no second level to pick — one
 * dropdown replaces the old owner → company pair.
 *
 * The search runs on the SERVER (`GET /fleet-owners/options?q=`), which is the
 * whole point: the previous version fetched one page of `/fleet-owners` and
 * filtered it in the browser, so every company past the first 20 was
 * unreachable no matter what the operator typed.
 *
 * Three behaviours that keep it usable with real data volumes:
 * - each search TERM is its own query key, so switching terms does not clobber
 *   another term's page and the cursor per term is independent;
 * - "load more" walks the real cursor instead of filtering an exhausted array;
 * - a selected owner stays selected (and labelled) even when a new search hides
 *   it from the results — losing a choice mid-form is worse than showing one
 *   extra option.
 */
export function OwnerPicker({
  ownerId,
  onOwnerChange,
  onOwnerResolved,
  label,
  placeholder,
  allowEmpty = true,
}: {
  ownerId: string;
  onOwnerChange: (id: string) => void;
  /**
   * Reports the display label of the current selection so a caller can name the
   * choice in its own copy (e.g. "added to {owner}") without re-fetching it.
   */
  onOwnerResolved?: (label: string | null) => void;
  label?: string;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  /**
   * Extra pages, tagged with the term they belong to. Tagging instead of
   * clearing on a term change means a stale term's rows can never leak into a
   * new search — and no effect (and therefore no cascading render) is needed.
   */
  const [extra, setExtra] = useState<{ term: string; rows: OwnerOption[] }>({
    term: "",
    rows: [],
  });
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounce: one request per settled term, not one per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setSearch(input.trim()), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [input]);

  const settled = search === input.trim();
  const { data, isLoading, isFetching, error } = useApiQuery(
    qk.ownerOptions(search),
    () => fetchOwnerOptions(search, null),
    { enabled: settled },
  );

  const extraRows = useMemo(
    () => (extra.term === search ? extra.rows : []),
    [extra, search],
  );

  const options = useMemo(() => {
    const base = data?.items ?? [];
    const seen = new Set(base.map((option) => option.id));
    return [...base, ...extraRows.filter((option) => !seen.has(option.id))];
  }, [data, extraRows]);

  // Keep a choice the operator already made, even when a new search filters it
  // out of the list — the form must not silently drop a valid selection.
  const selected = useMemo(
    () => options.find((option) => option.id === ownerId) ?? null,
    [options, ownerId],
  );
  const selectedOutsideResults = Boolean(ownerId) && !selected;

  // Publish the resolved label so the caller can name the selection. Falls back
  // to null once a search hides the choice, which the caller treats as
  // "unknown owner" rather than as an empty selection.
  const selectedLabel = selected?.label ?? null;
  useEffect(() => {
    onOwnerResolved?.(selectedLabel);
  }, [onOwnerResolved, selectedLabel]);

  const nextCursor = data?.nextCursor ?? null;

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const more = await fetchOwnerOptions(search, nextCursor);
    setLoadingMore(false);
    if (!more.ok) return;
    setExtra((state) => {
      const base = state.term === search ? state.rows : [];
      const merged = [...base, ...more.data.items];
      return {
        term: search,
        rows: merged.filter(
          (option, index) =>
            merged.findIndex((candidate) => candidate.id === option.id) === index,
        ),
      };
    });
  }

  const searching = !settled;
  const showSpinner = isLoading || searching || isFetching;

  return (
    <div className="mb-1.5">
      <label className="block text-sm">
        <span className="mb-1.5 block font-bold text-[#334454]">
          {label ?? t("fleetOwnerPicker.label")}
        </span>
        <input
          type="search"
          className="input-field mb-2 w-full"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("fleetOwnerPicker.searchPlaceholder")}
          aria-label={t("fleetOwnerPicker.searchAria")}
          aria-busy={showSpinner}
        />
        <select
          className="select-field w-full"
          value={ownerId}
          onChange={(event) => onOwnerChange(event.target.value)}
          aria-label={label ?? t("fleetOwnerPicker.label")}
          aria-invalid={Boolean(error)}
        >
          {allowEmpty ? (
            <option value="">{placeholder ?? t("fleetOwnerPicker.placeholder")}</option>
          ) : null}
          {isLoading ? <option value="">{t("common.loading.page")}</option> : null}
          {error ? <option value="">{t("fleetOwnerPicker.searchFailed")}</option> : null}
          {!isLoading && !error && options.length === 0 && !showSpinner ? (
            <option value="">{t("fleetOwnerPicker.noResults")}</option>
          ) : null}
          {selectedOutsideResults ? (
            // Rendered as a disabled marker, not a selectable option: the id is
            // still submitted, and the operator can see why the list looks short.
            <option value={ownerId} disabled>
              {t("fleetOwnerPicker.selectedUnknown")}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {showSpinner ? (
        <p className="mt-1.5 text-xs text-[#6b7c8c]" role="status">
          {t("fleetOwnerPicker.searching")}
        </p>
      ) : null}

      {!showSpinner && !error && options.length === 0 ? (
        <p className="mt-1.5 text-xs text-[#6b7c8c]">{t("fleetOwnerPicker.noResultsHint")}</p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-red-600">
          {t("fleetOwnerPicker.searchFailed")}
        </p>
      ) : null}

      {nextCursor ? (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="mt-2 text-xs font-bold text-[#1f6f8b] underline disabled:opacity-60"
        >
          {loadingMore ? t("fleetOwnerPicker.loadingMore") : t("fleetOwnerPicker.loadMore")}
        </button>
      ) : null}

      {!showSpinner && options.length > 0 ? (
        <p className="mt-1.5 text-xs text-[#6b7c8c]">
          {t("fleetOwnerPicker.resultCount", { count: options.length })}
        </p>
      ) : null}
    </div>
  );
}
