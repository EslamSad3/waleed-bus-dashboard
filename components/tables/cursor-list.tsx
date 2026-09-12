"use client";

import { useState, type ReactNode } from "react";

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

  return (
    <div className="flex flex-col gap-3">
      {filterBar}
      {visible.length === 0 ? (
        <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-[#606060]">
          {emptyMessage}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((item, i) => (
            <li key={keyOf(item, i)}>{renderItem(item, i)}</li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {cursor && (
        <button
          type="button"
          onClick={more}
          disabled={loading}
          className="self-center rounded-xl bg-[#daeaf5] px-6 py-2 text-sm font-semibold text-[#2f719e] transition-colors hover:bg-[#c4def3] disabled:opacity-60"
        >
          {loading ? "جاري التحميل…" : "عرض المزيد"}
        </button>
      )}
    </div>
  );
}
