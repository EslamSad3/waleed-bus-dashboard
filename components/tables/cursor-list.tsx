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
  initialItems: T[];
  initialCursor: string | null;
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
 * Cursor-paged list (Principle III): opaque `nextCursor`, default limit from the
 * caller, "عرض المزيد" affordance, never page counts. Filters apply over loaded
 * pages only — the backend exposes cursor+limit and nothing else.
 */
export function CursorList<T>({
  gridId = "cursor-list",
  withActions = true,
  initialItems,
  initialCursor,
  loadMore,
  keyOf,
  renderItem,
  filter,
  filterBar,
  columnDefs: providedColumnDefs,
  emptyMessage,
}: Props<T>) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when the server sends a new first page (fleet/scope change).
  const [seenFirst, setSeenFirst] = useState(initialItems);
  if (seenFirst !== initialItems) {
    setSeenFirst(initialItems);
    setItems(initialItems);
    setCursor(initialCursor);
    setError(null);
  }

  const visible = filter ? items.filter(filter) : items;

  async function more() {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const page = await loadMore(cursor);
      setItems((prev) => [...prev, ...page.items]);
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
            minWidth: 420,
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
      loadMore={async (nextCursor) => {
        const page = await loadMore(nextCursor);
        return { ...page, items: filter ? page.items.filter(filter) : page.items };
      }}
      loading={loading}
      errorMessage={error}
      emptyMessage={emptyMessage}
      toolbar={filterBar ? <div className="contents">{filterBar}</div> : undefined}
      showSearch={!filterBar}
      getRowId={(item) => keyOf(item, items.indexOf(item))}
    />
  );
}
