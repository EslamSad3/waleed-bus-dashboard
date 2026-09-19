"use client";

import { isValidElement, useState, type ReactNode } from "react";
import Link from "next/link";
import type { ICellRendererParams } from "ag-grid-community";
import { AgGridTable } from "./ag-grid-table";
import { arabicGridHeaders } from "./ag-grid-locale";
import type { CommunityColumnDef } from "./ag-grid-types";

export type CursorPage<T> = { items: T[]; nextCursor: string | null };

type Props<T> = {
  initialItems: T[];
  initialCursor: string | null;
  /** Server action: fetch one cursor page. Closed-over args must be serializable. */
  loadMore: (cursor: string) => Promise<CursorPage<T>>;
  keyOf: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
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
      setError("حصلت مشكلة، حاول تاني");
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
            if (typeof params.value === "boolean") return params.value ? "نشط" : "موقوف";
            if (field.endsWith("At")) return new Date(String(params.value)).toLocaleString("ar-EG");
            return String(params.value);
          },
        } as CommunityColumnDef<T>))
    : []);

  const columns: CommunityColumnDef<T>[] = [
    ...valueColumns,
    {
      headerName: "إجراءات",
      pinned: "right",
      sortable: false,
      filter: false,
      exportable: false,
      minWidth: 220,
      cellRenderer: (params: ICellRendererParams<T>) => {
        if (!params.data) return null;
        const rendered = renderItem(params.data, visible.indexOf(params.data));
        if (isValidElement<{ href?: string }>(rendered) && typeof rendered.props.href === "string") {
          return <Link href={rendered.props.href} className="ag-grid-row-action">فتح</Link>;
        }
        return rendered;
      },
    },
  ];

  return (
    <AgGridTable<T>
      gridId="cursor-list"
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
