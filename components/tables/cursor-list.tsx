"use client";

import { isValidElement, useState, type ReactNode } from "react";
import Link from "next/link";
import type { ICellRendererParams } from "ag-grid-community";
import { AgGridTable } from "./ag-grid-table";
import { arabicGridHeaders } from "./ag-grid-locale";
import type { CommunityColumnDef } from "./ag-grid-types";
import { t } from "@/lib/i18n/t";

export type CursorPage<T> = { items: T[]; nextCursor: string | null };

type Props<T> = {
  /** Grid id used for data-grid-id and the CSV export filename. */
  gridId?: string;
  /** Show the pinned actions column (default true). Read-only tables turn it off. */
  withActions?: boolean;
  /** Actions column width; the default fits three short chips. */
  actionsWidth?: number;
  initialItems: T[];
  initialCursor: string | null;
  /**
   * Identifies the QUERY SCOPE behind `initialItems` (owner, line, filters that
   * change which rows the server returns). A change here discards the
   * accumulated pages, because they belong to a different result set. Leave it
   * `null` when the scope is fixed for the component's lifetime.
   */
  scopeKey?: string | null;
  /** Server action: fetch one cursor page. Closed-over args must be serializable. */
  loadMore: (cursor: string) => Promise<CursorPage<T>>;
  keyOf: (item: T, index: number) => string;
  renderItem?: (item: T, index: number) => ReactNode;
  /** Client-side predicate over accumulated items (research R4). */
  filter?: (item: T) => boolean;
  filterBar?: ReactNode;
  columnDefs?: CommunityColumnDef<T>[];
  emptyMessage: string;
};

/**
 * Is the incoming first page the SAME data we already hold?
 *
 * Compared by CONTENT, not by array identity. A parent that rebuilds the array
 * on every render (`items.map(...)`, `x ?? []`) hands us a new object each time;
 * treating that as a change would reconcile forever. Comparing the id sequence
 * plus serialized row content means a real edit still reconciles even when its
 * ID is unchanged, while a cosmetic parent re-render does not.
 */
function isSameFirstPage<T>(previous: T[] | undefined, next: T[], keyOf: (item: T, index: number) => string): boolean {
  if (!previous || previous.length !== next.length) return false;
  for (let index = 0; index < next.length; index++) {
    if (previous[index] === next[index]) continue;
    if (keyOf(previous[index], index) !== keyOf(next[index], index)) return false;
    // Query refetches keep the same ID for an edited record. Compare its data,
    // while tolerating parent components that recreate equal row objects.
    if (JSON.stringify(previous[index]) !== JSON.stringify(next[index])) return false;
  }
  return true;
}

/**
 * Cursor-paged list (Principle III): opaque `nextCursor`, default limit from the
 * caller, "عرض المزيد" affordance, never page counts. Filters apply over loaded
 * pages only — the backend exposes cursor+limit and nothing else.
 *
 * This component is the SINGLE owner of the accumulated pages (the grid below is
 * fully controlled). It used to reset `items` whenever the `initialItems`
 * array identity changed, which — with a parent that rebuilds the first page on
 * every render — silently discarded every page the operator had loaded. And a
 * mutation that patched page 1 replaced the WHOLE list, so a row that had been
 * reached through "load more" vanished on the next edit.
 *
 * Reconciliation is therefore by ROW ID, not by array identity:
 * - a first-page row that is already loaded replaces it in place (so editing a
 *   row on page 3 updates immediately, and a first-page change cannot reorder
 *   or drop the later pages);
 * - a first-page row that disappeared is dropped;
 * - a genuinely new first-page row is prepended;
 * - later pages are preserved until `scopeKey` changes.
 */
export function CursorList<T>({
  gridId = "cursor-list",
  withActions = true,
  actionsWidth = 330,
  initialItems,
  initialCursor,
  scopeKey = null,
  loadMore,
  keyOf,
  renderItem,
  filter,
  filterBar,
  columnDefs: providedColumnDefs,
  emptyMessage,
}: Props<T>) {
  const [items, setItems] = useState<T[]>(initialItems);
  /** Ids of the rows that came from the FIRST page, so later pages stay theirs. */
  const [pageOneIds, setPageOneIds] = useState<string[]>(() =>
    initialItems.map((item, index) => keyOf(item, index)),
  );
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Render-phase reconciliation (no setState-in-effect, no extra render pass).
  // `items` / `pageOneIds` still hold the PREVIOUS state here, which is exactly
  // what the reconciliation needs.
  const previousLength = items.length;
  const [seenFirst, setSeenFirst] = useState<T[]>(initialItems);
  const [seenScope, setSeenScope] = useState(scopeKey);
  const scopeChanged = seenScope !== scopeKey;
  const firstPageChanged = !scopeChanged && !isSameFirstPage(seenFirst, initialItems, keyOf);
  if (scopeChanged || firstPageChanged) {
    setSeenFirst(initialItems);
    setSeenScope(scopeKey);

    const nextIds = initialItems.map((item, index) => keyOf(item, index));
    const nextById = new Map(nextIds.map((id, index) => [id, initialItems[index]]));

    if (scopeChanged) {
      // A different result set: the accumulated pages do not belong to it.
      setItems(initialItems);
      setPageOneIds(nextIds);
      setCursor(initialCursor);
      setError(null);
    } else {
      const previousPageOne = new Set(pageOneIds);
      // Head: the first page exactly as the server now reports it, keeping
      // later pages in their original order below.
      const head = initialItems;
      // Tail: everything the operator loaded through "load more", minus rows
      // that have since moved onto the first page (the head version wins).
      const tail = items.filter((item, index) =>
        !previousPageOne.has(keyOf(item, index)) && !nextById.has(keyOf(item, index)),
      );
      const merged: T[] = [];
      const seen = new Set<string>();
      for (const item of [...head, ...tail]) {
        const id = keyOf(item, merged.length);
        if (seen.has(id)) continue;
        seen.add(id);
        merged.push(item);
      }
      setItems(merged);
      setPageOneIds(nextIds);
      // Keep an already-advanced cursor: resetting it to the first page's cursor
      // would re-fetch page 2 and duplicate rows. Only adopt the new one when
      // nothing beyond the first page is loaded yet.
      if (pageOneIds.length === previousLength) setCursor(initialCursor);
    }
  }

  const visible = filter ? items.filter(filter) : items;
  /** Row id per index, so `getRowId` stays O(1) instead of scanning per row. */
  const rowIdByIndex = new Map(visible.map((item, index) => [item, keyOf(item, index)]));

  async function more(nextCursor: string) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const page = await loadMore(nextCursor);
      setItems((current) => {
        const seen = new Set(current.map((item, index) => keyOf(item, index)));
        const fresh = page.items.filter((item) => !seen.has(keyOf(item, 0)));
        return [...current, ...fresh];
      });
      setCursor(page.nextCursor);
    } catch {
      setError(t("common.error.unknown"));
    } finally {
      setLoading(false);
    }
  }

  const sample = visible[0] as Record<string, unknown> | undefined;
  const valueColumns: CommunityColumnDef<T>[] = providedColumnDefs ?? (sample
    ? Object.keys(sample)
        .filter((field) => {
          const value = sample[field];
          return value === null || ["string", "number", "boolean"].includes(typeof value);
        })
        .map((field) => ({
          field: field as CommunityColumnDef<T>["field"],
          headerName: arabicGridHeaders[field] ?? field,
          hide: field === "id" || field.endsWith("Id") || field === "picture",
          exportable: field !== "id" && !field.endsWith("Id") && field !== "picture",
          cellDataType: typeof sample[field] === "boolean" ? "text" : undefined,
          filter: (typeof sample[field] === "number" ? "agNumberColumnFilter" : "agTextColumnFilter") as CommunityColumnDef<T>["filter"],
          valueFormatter: (params) => {
            if (params.value == null) return "";
            if (typeof params.value === "boolean") return params.value ? t("common.status.active") : t("common.status.inactive");
            if (field.endsWith("At")) return new Date(String(params.value)).toLocaleString("ar-EG");
            return String(params.value);
          },
        } as CommunityColumnDef<T>))
    : []);

  const columns: CommunityColumnDef<T>[] = [
    ...valueColumns,
    ...(withActions
      ? [
          {
            colId: "actions",
            headerName: t("cursorList.actionsColumn"),
            // The grid runs with `enableRtl`, and AG Grid mirrors pinned sides
            // for RTL rows (they get `flex-direction: row-reverse` and the
            // scrolling section takes order:1), so this renders on the visual
            // left edge of the table.
            pinned: "left" as const,
            sortable: false,
            filter: false,
            exportable: false,
            // Every grid shows at most three short chips (view / edit /
            // delete) — anything else lives on the detail page — so one
            // shared width fits all tables and data columns keep room.
            width: actionsWidth,
            minWidth: Math.min(actionsWidth, 300),
            cellRenderer: (params: ICellRendererParams<T>) => {
              if (!params.data) return null;
              const rendered = renderItem?.(params.data, visible.indexOf(params.data));
              if (isValidElement<{ href?: string }>(rendered) && typeof rendered.props.href === "string") {
                return <Link href={rendered.props.href} className="ag-grid-row-action">{t("cursorList.open")}</Link>;
              }
              return rendered ?? null;
            },
          } satisfies CommunityColumnDef<T>,
        ]
      : []),
  ];

  return (
    <AgGridTable<T>
      gridId={gridId}
      rows={visible}
      columnDefs={columns}
      nextCursor={cursor}
      loadMore={(nextCursor) => more(nextCursor)}
      loading={loading}
      errorMessage={error}
      emptyMessage={emptyMessage}
      toolbar={filterBar ? <div className="contents">{filterBar}</div> : undefined}
      showSearch={!filterBar}
      getRowId={(item) => rowIdByIndex.get(item) ?? keyOf(item, 0)}
    />
  );
}
