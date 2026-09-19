# Research: AG Grid Community Tables

## R1. Community React integration

**Decision**: Add `ag-grid-react` and use the matching `ag-grid-community` package
with only the required Community modules. Prefer a typed `AgGridReact` client
component inside the existing Next.js client-component boundaries.

**Rationale**: The official React quick start documents `ag-grid-react`, typed
column definitions, a fixed-size parent container, and module registration. The
current app is React 19 + Next.js 16 and already isolates browser-interactive
components with `"use client"`.

**Alternatives considered**: Continue native tables or introduce another table
library. Native tables would duplicate search, filter, pagination, and export
behavior across routes; another library would violate the explicit AG Grid
constraint.

**Reference**: AG Grid React quick start,
https://www.ag-grid.com/react-data-grid/getting-started/

## R2. Client-side pagination and backend cursor pages

**Decision**: Use AG Grid client-side pagination for rows already loaded in the
browser. Keep the existing opaque cursor loader and append each `{items,nextCursor}`
response through an explicit Arabic load-more control.

**Rationale**: The constitution forbids offset pagination and requires cursor
fidelity. AG Grid's client-side row model supports pagination over an in-memory
array without requiring the enterprise server-side row model. This preserves the
existing `CursorList` behavior while adding the requested page controls.

**Alternatives considered**: AG Grid Infinite Row Model or Server-Side Row Model.
Those models would change the existing fetch contract, increase integration
complexity, and risk enterprise-only functionality. Offset/page-count API
pagination is explicitly forbidden.

**Reference**: AG Grid row pagination,
https://www.ag-grid.com/javascript-data-grid/row-pagination/

## R3. Search and filters available in Community Edition

**Decision**: Use the grid quick filter for global search and Community provided
text, number, and date filters per column. Do not use the Enterprise Set Filter,
Multi Filter, or Tool Panel.

**Rationale**: The official filtering documentation identifies text, number, and
date provided filters as available options and identifies Set Filter/Multi Filter
as Enterprise. This supports the requested filters without licensing or hidden
module dependencies.

**Alternatives considered**: Enterprise Set Filter or custom external filter
panels. Enterprise filters violate the scope; custom panels add unnecessary
state duplication when provided Community filters meet the requirements.

**Reference**: AG Grid column filters,
https://www.ag-grid.com/javascript-data-grid/filtering/

## R4. CSV export and safety

**Decision**: Use the Community CSV export API from the grid API, with explicit
file names, Arabic headers, visible exportable columns, and a cell transformation
that neutralizes spreadsheet formula prefixes.

**Rationale**: Official documentation confirms API CSV export is supported in
Community, while context-menu export is Enterprise. The same documentation warns
about CSV injection for values beginning with `+`, `-`, `=`, `@`, tabs, or carriage
returns, so export must sanitize untrusted values.

**Alternatives considered**: Excel export, browser-generated ad hoc CSV, or
Enterprise context menus. Excel export is outside Community Edition; ad hoc CSV
would duplicate grid formatting and filtering semantics; context menus require
Enterprise.

**Reference**: AG Grid CSV export,
https://www.ag-grid.com/javascript-data-grid/csv-export/

## R5. Existing repository integration

**Decision**: Adapt `components/tables/cursor-list.tsx` or replace its rendering
internals while keeping its cursor callback shape. Migrate pages incrementally,
with domain column definitions remaining near each page.

**Rationale**: Existing actions consistently return `CursorPage<T>`, `lib/api.ts`
preserves the BFF boundary, and `stores/filters.ts` already owns module-level
filter state and fleet scope. A shared component can reduce duplicated UI without
moving data fetching or mutation ownership.

**Alternatives considered**: Rework every action to expose a new grid datasource
or move all filtering into a global store. Both broaden the change and risk
breaking fleet scope, URL state, and current backend behavior.

## R6. Scope boundary for non-paginated collections

**Decision**: Use the same grid for full-array list endpoints such as stops,
trip lines, permission catalogs, and report collections, but omit cursor load-more
when no `nextCursor` exists. Keep ordered stop editing controls as ordered form
inputs rather than forcing them into a read-only data grid.

**Rationale**: The user request applies to pages that display tables/collections,
while route editing has a distinct drag/order interaction. The shared grid can
support both cursor-backed and fully loaded rows without inventing pagination.

**Alternatives considered**: Force every array into cursor pagination or render
ordered editors as grids. Either would distort existing domain behavior.
