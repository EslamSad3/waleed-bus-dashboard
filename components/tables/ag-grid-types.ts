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
  /** The ACCUMULATED rows. The grid is fully controlled: it never keeps a copy. */
  rows: T[];
  columnDefs: CommunityColumnDef<T>[];
  nextCursor?: string | null;
  /**
   * Asks the owner (CursorList) for the next page. Resolves once the owner has
   * appended it; the return value is ignored because the owner is the one that
   * holds the accumulated rows.
   */
  loadMore?: (cursor: string) => Promise<void> | void;
  scopeKey?: string | null;
  loading?: boolean;
  errorMessage?: string | null;
  emptyMessage: string;
  toolbar?: React.ReactNode;
  showSearch?: boolean;
  getRowId?: (row: T) => string;
  exportOptions?: GridExportOptions;
};