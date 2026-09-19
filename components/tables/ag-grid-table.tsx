"use client";

import { useState } from "react";
import {
  AllCommunityModule,
  type GridApi,
  type GridReadyEvent,
  themeQuartz,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { arabicGridDefaultColDef, arabicGridLocale } from "./ag-grid-locale";
import type { AgGridTableProps } from "./ag-grid-types";

function safeCsvValue(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /^[+\-=@\t\r]/.test(text) ? `'${text}` : text;
}

export function AgGridTable<T>({
  gridId,
  rows: initialRows,
  columnDefs,
  nextCursor: initialCursor = null,
  loadMore,
  loading = false,
  errorMessage,
  emptyMessage,
  toolbar,
  showSearch = true,
  getRowId,
  exportOptions,
}: AgGridTableProps<T>) {
  const [rows, setRows] = useState(initialRows);
  const [cursor, setCursor] = useState(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quickFilterText, setQuickFilterText] = useState("");
  const [gridApi, setGridApi] = useState<GridApi<T> | null>(null);

  function onGridReady(event: GridReadyEvent<T>) {
    setGridApi(event.api);
  }

  function exportCsv() {
    if (!gridApi) return;
    const columnKeys = normalizedColumnDefs
      .filter((column) => column.exportable !== false && (column.field || column.colId))
      .map((column) => (column.colId ?? column.field) as string);

    gridApi.exportDataAsCsv({
      ...exportOptions,
      columnKeys,
      fileName: exportOptions?.fileName ?? `${gridId}.csv`,
      exportedRows: "filteredAndSorted",
      processCellCallback: (params) => safeCsvValue(params.value),
    });
  }

  async function loadNextPage() {
    if (!cursor || !loadMore || loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const page = await loadMore(cursor);
      setRows((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setLoadError("حصلت مشكلة، حاول تاني");
    } finally {
      setLoadingMore(false);
    }
  }

  const displayError = errorMessage ?? loadError;
  const gridHeight = Math.min(560, Math.max(240, 144 + rows.length * 48));
  const normalizedColumnDefs = columnDefs.map((column) => {
    if (column.field !== "isActive" && column.field !== "hasReports") return column;
    return {
      ...column,
      cellDataType: "text" as const,
      valueFormatter: column.valueFormatter ?? ((params: { value: unknown }) => {
        if (column.field === "hasReports") return params.value ? "نعم" : "لا";
        return params.value ? "نشط" : "موقوف";
      }),
    };
  });

  return (
    <div className="ag-grid-shell" data-grid-id={gridId} dir="rtl">
      <div className="ag-grid-toolbar" role="toolbar" aria-label="أدوات الجدول">
        {showSearch ? (
          <input
            type="search"
            value={quickFilterText}
            placeholder="بحث في النتائج المحملة"
            aria-label="بحث في النتائج المحملة"
            className="ag-grid-search"
          />
        ) : null}
        {toolbar}
        <span className="ag-grid-count" aria-live="polite">{rows.length} صف</span>
        <button type="button" onClick={exportCsv} className="ag-grid-export" aria-label="تصدير البيانات إلى ملف CSV">
          تصدير CSV
        </button>
      </div>

      {displayError ? <p role="alert" className="ag-grid-error">{displayError}</p> : null}
      {loading ? <p className="ag-grid-state">جاري التحميل…</p> : null}
      {!loading && rows.length === 0 ? <p className="ag-grid-state">{emptyMessage}</p> : null}

      {rows.length > 0 ? (
        <div className="ag-grid-viewport ag-theme-quartz" style={{ height: `${gridHeight}px` }}>
          <AgGridReact<T>
            modules={[AllCommunityModule]}
            theme={themeQuartz}
            enableRtl
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={arabicGridDefaultColDef}
            localeText={arabicGridLocale}
            quickFilterText={quickFilterText}
            pagination
            paginationPageSize={20}
            paginationPageSizeSelector={[10, 20, 50, 100]}
            rowHeight={48}
            getRowId={getRowId ? (params) => getRowId(params.data) : undefined}
            onGridReady={onGridReady}
          />
        </div>
      ) : null}

      {cursor && loadMore ? (
        <button type="button" onClick={() => void loadNextPage()} disabled={loadingMore} className="ag-grid-load-more">
          {loadingMore ? "جاري التحميل…" : "عرض المزيد"}
        </button>
      ) : null}
    </div>
  );
}