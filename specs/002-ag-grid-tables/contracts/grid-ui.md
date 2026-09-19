# UI Contract: Shared AG Grid Community Table

This is an internal component contract for all in-scope shell collection views.
It is not a new backend API.

## Required Inputs

```ts
type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

type AgGridTableProps<T> = {
  gridId: string;
  rows: T[];
  columnDefs: CommunityColumnDef<T>[];
  nextCursor?: string | null;
  loadMore?: (cursor: string) => Promise<CursorPage<T>>;
  scopeKey?: string | null;
  loading?: boolean;
  errorMessage?: string | null;
  emptyMessage: string;
  onRowAction?: (action: string, row: T) => void;
};
```

The implementation may refine these types, but it must preserve the following
semantics:

- `rows` are already authorized and shaped by existing server/action boundaries.
- `columnDefs` are domain-owned and include Arabic headers and typed filters.
- `loadMore` receives only the opaque `nextCursor` and returns the existing cursor
  page shape.
- Row actions remain domain callbacks or links and keep existing confirmations.
- The component must not accept `BUS_API_URL`, access tokens, or raw backend
  credentials.

## Required Behavior

- Render AG Grid Community Edition with client-side rows.
- Provide Arabic quick search, Community text/number/date column filters, client
  pagination, configurable page size, and CSV export.
- Use Arabic RTL locale text and accessible labels while preserving Western digits
  in table values.
- Keep a stable grid container height and bounded horizontal overflow.
- Show Arabic loading, empty, and error states without deleting already loaded rows.
- Expose an Arabic load-more control only when `nextCursor` and `loadMore` exist.
- On load-more success append rows and update the cursor; on failure preserve rows
  and expose retryable feedback.
- Reset rows, cursor, filters, and page when `scopeKey` changes.
- Exclude action/control columns from export unless explicitly marked exportable.

## Community Module Boundary

Allowed: client-side row model, pagination, CSV export, text filter, number
filter, date filter, sorting, and custom cell renderers required for links/actions.

Forbidden: `ag-grid-enterprise`, enterprise Set Filter, Multi Filter, Tool Panel,
context-menu export, Excel export, server-side row model, and any API contract
that introduces offset pages or totals.

## Accessibility and Localization

- All toolbar, filter, export, load-more, pagination, and row-action controls have
  Arabic accessible names.
- Focus remains visible and keyboard navigation reaches every required control.
- Filter and export status does not rely on color alone.
- CSV values are sanitized against spreadsheet formula injection.
