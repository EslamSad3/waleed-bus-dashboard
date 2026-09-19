import type { ColDef, CsvExportParams } from "ag-grid-community";

export type CommunityColumnDef<T> = ColDef<T> & {
  exportable?: boolean;
};

export type GridExportOptions = Omit<CsvExportParams, "columnKeys"> & {
  fileName?: string;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type AgGridTableProps<T> = {
  gridId: string;
  rows: T[];
  columnDefs: CommunityColumnDef<T>[];
  nextCursor?: string | null;
  loadMore?: (cursor: string) => Promise<CursorPage<T>>;
  scopeKey?: string | null;
  loading?: boolean;
  errorMessage?: string | null;
  emptyMessage: string;
  toolbar?: React.ReactNode;
  showSearch?: boolean;
  getRowId?: (row: T) => string;
  exportOptions?: GridExportOptions;
};