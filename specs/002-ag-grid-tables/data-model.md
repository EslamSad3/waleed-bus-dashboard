# Data Model: AG Grid Community Tables

This feature introduces no database entities or API payload changes. The model
below describes the client presentation state and its relationship to existing
backend cursor pages.

## Grid View

A reusable table instance owned by one shell or detail-page collection.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `gridId` | string | yes | Stable module/detail identifier, unique within the page |
| `rows` | `T[]` | yes | Accumulated loaded records; typed to the domain collection |
| `columnDefs` | column definition list | yes | Domain-owned fields, Arabic headers, filters, and action renderers |
| `quickFilterText` | string | no | Searches loaded rows only; empty string means no global search |
| `filterModel` | filter model | no | Community text/number/date column filter state |
| `pageSize` | number | yes | One of the configured client page sizes |
| `nextCursor` | string or null | yes | Opaque backend cursor; null means no more rows to load |
| `loading` | boolean | yes | True while the next cursor page is being requested |
| `errorMessage` | string or null | no | Arabic request error while preserving loaded rows |
| `scopeKey` | string or null | no | Fleet/module scope used to reset rows when scope changes |

## Cursor Page

Existing API/action shape and source of truth for fetching additional records.

```ts
type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};
```

Rules:

- `nextCursor` is opaque and must be passed back unchanged.
- New `items` append to `rows`; they must not replace rows from the active scope.
- A scope/filter reset may replace the first page and reset grid pagination.
- No offset, total count, or fabricated page count is added to the API contract.

## Column Definition

A domain-owned description of one visible or exportable field.

| Property | Purpose |
|---|---|
| Field key | Reads the typed row value |
| Arabic header | Display and CSV header text |
| Filter kind | Text, number, date, or disabled for action columns |
| Value formatter | Human-readable date/status/number display and safe CSV value |
| Minimum width | Prevents layout collapse for labels and actions |
| Exportable | Excludes action/control columns from CSV |
| Cell action | Preserves detail/edit/delete links and confirmation flows |

## Export File

A browser download generated from the active grid view.

- Format: CSV, Community API export only.
- Rows: loaded rows after the active quick filter and column filters, according to
  the agreed export policy.
- Columns: visible/exportable domain columns, excluding action controls.
- Encoding: UTF-8 with Arabic headers and values preserved.
- Safety: values beginning with spreadsheet formula prefixes are neutralized.

## State Transitions

1. **Initial load**: first page becomes `rows`; `nextCursor` is stored; page resets.
2. **Search/filter**: grid derives visible rows from `rows`; backend is unchanged.
3. **Load more**: request stored `nextCursor`; append items; replace cursor; keep
   active search/filter model usable.
4. **Scope change**: replace rows with the new scope's first page, clear request
   error, reset page and cursor.
5. **Load failure**: keep existing rows and filter/page state; set Arabic error;
   allow retry while the cursor remains available.
6. **No next cursor**: disable/hide load-more; client pagination still works on
   accumulated rows.
