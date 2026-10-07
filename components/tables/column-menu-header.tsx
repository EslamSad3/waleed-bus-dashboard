"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Column, IHeaderParams } from "ag-grid-community";
import { t } from "@/lib/i18n/t";

/**
 * Community-safe column menu (the hamburger menu in the reference is an
 * Enterprise `ColumnMenuModule` feature and the app runs Community only).
 *
 * Renders the header label + sort state + a ⋮ button opening an
 * Egyptian-Arabic menu driven purely by Grid API: sort, pin, autosize,
 * hide, choose columns, reset. Filtering stays in the floating-filter row,
 * so the Enterprise filter-popup button is intentionally not replicated.
 *
 * Columns with `sortable === false && filter === false` (the pinned
 * إجراءات column, audit grids) render a plain label — no menu.
 */
function isMenuable(column: Column): boolean {
  const def = column.getColDef();
  if (def.colId === "actions") return false;
  return def.sortable !== false || def.filter !== false;
}

export function ColumnMenuHeader(params: IHeaderParams) {
  const { api, column } = params;
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [, setTick] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    api.addEventListener("sortChanged", bump);
    api.addEventListener("columnPinned", bump);
    api.addEventListener("columnVisible", bump);
    return () => {
      api.removeEventListener("sortChanged", bump);
      api.removeEventListener("columnPinned", bump);
      api.removeEventListener("columnVisible", bump);
    };
  }, [api]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open ]);

  if (!isMenuable(column)) {
    return <span className="ag-header-cell-label-text">{params.displayName}</span>;
  }

  const colId = column.getColId();
  const sort = column.getSort() ?? null;
  const pinned = column.getPinned();
  const sortable = column.getColDef().sortable !== false;

  function openMenu() {
    setAnchor(buttonRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
  }

  function run(fn: () => void) {
    fn();
    setOpen(false);
    buttonRef.current?.focus();
  }

  const itemClass =
    "flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-[#334454] hover:bg-slate-100 disabled:opacity-40";

  const menu =
    open && anchor ? (
      <>
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
        <div
          ref={menuRef}
          role="menu"
          aria-label={t("agGridMenu.menuAria")}
          dir="rtl"
          className="fixed z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
          style={{
            top: Math.min(anchor.bottom + 4, window.innerHeight - 320),
            left: Math.max(8, Math.min(anchor.right - 224, window.innerWidth - 232)),
          }}
        >
          <button type="button" role="menuitem" className={itemClass} disabled={sort === "asc"} onClick={() => run(() => api.applyColumnState({ state: [{ colId, sort: "asc" }] }))}>
            <span aria-hidden="true">↑</span> {t("agGridMenu.sortAsc")}
          </button>
          <button type="button" role="menuitem" className={itemClass} disabled={sort === "desc"} onClick={() => run(() => api.applyColumnState({ state: [{ colId, sort: "desc" }] }))}>
            <span aria-hidden="true">↓</span> {t("agGridMenu.sortDesc")}
          </button>
          <button type="button" role="menuitem" className={itemClass} disabled={sort === null} onClick={() => run(() => api.applyColumnState({ state: [{ colId, sort: null }] }))}>
            {t("agGridMenu.clearSort")}
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button type="button" role="menuitem" className={itemClass} onClick={() => run(() => api.applyColumnState({ state: [{ colId, pinned: "right" }] }))}>
            {t("agGridMenu.pinStart")}
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={() => run(() => api.applyColumnState({ state: [{ colId, pinned: "left" }] }))}>
            {t("agGridMenu.pinEnd")}
          </button>
          <button type="button" role="menuitem" className={itemClass} disabled={!pinned} onClick={() => run(() => api.applyColumnState({ state: [{ colId, pinned: null }] }))}>
            {t("agGridMenu.unpin")}
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button type="button" role="menuitem" className={itemClass} onClick={() => run(() => api.autoSizeColumns([column]))}>
            {t("agGridMenu.autosizeThis")}
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={() => run(() => api.autoSizeAllColumns())}>
            {t("agGridMenu.autosizeAll")}
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={() => run(() => api.setColumnsVisible([column], false))}>
            {t("agGridMenu.hideColumn")}
          </button>
          <div className="my-1 border-t border-slate-100" />
          <p className="px-3 py-1 text-xs font-bold text-[#71808d]">{t("agGridMenu.chooseColumns")}</p>
          <div className="max-h-44 overflow-y-auto pb-1">
            {api.getColumns()?.map((col) => {
              const id = col.getColId();
              if (id === "actions") return null;
              const visible = col.isVisible();
              return (
                <label key={id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[#334454] hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => api.setColumnsVisible([col], !visible)}
                  />
                  {api.getDisplayNameForColumn(col, "header")}
                </label>
              );
            })}
          </div>
          <div className="my-1 border-t border-slate-100" />
          <button type="button" role="menuitem" className={itemClass} onClick={() => run(() => api.resetColumnState())}>
            {t("agGridMenu.resetColumns")}
          </button>
        </div>
      </>
    ) : null;

  return (
    <span
      className="flex w-full items-center gap-1"
      aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : "none"}
    >
      {sortable ? (
        <button
          type="button"
          title={t("agGridMenu.sortHint")}
          aria-label={`${params.displayName} — ${t("agGridMenu.sortHint")}`}
          onClick={(event) => params.progressSort(event.shiftKey)}
          className="ag-header-cell-label-text min-w-0 flex-1 cursor-pointer truncate bg-transparent p-0 text-start select-none"
        >
          {params.displayName}
        </button>
      ) : (
        <span className="ag-header-cell-label-text min-w-0 flex-1 truncate">{params.displayName}</span>
      )}
      {sort === "asc" ? (
        <span aria-hidden="true" className="text-xs text-[#71808d]">↑</span>
      ) : sort === "desc" ? (
        <span aria-hidden="true" className="text-xs text-[#71808d]">↓</span>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        aria-label={t("agGridMenu.menuAria")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          // The ⋮ sits inside the header: opening it must not sort the column.
          event.stopPropagation();
          if (open) setOpen(false);
          else openMenu();
        }}
        className="rounded px-1 text-base leading-none text-[#71808d] hover:bg-slate-200 hover:text-[#334454]"
      >
        <span aria-hidden="true">⋮</span>
      </button>
      {typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </span>
  );
}
