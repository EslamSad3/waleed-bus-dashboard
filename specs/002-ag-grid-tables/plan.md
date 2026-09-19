# Implementation Plan: AG Grid Community Tables

**Branch**: `002-ag-grid-tables` | **Date**: 2026-09-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-ag-grid-tables/spec.md`

## Summary

Replace hand-built record lists, native tables, and card-based collection views in
shell routes with a shared AG Grid React component using Community Edition only.
The component will expose Arabic RTL search, Community column filters, client-side
pagination over loaded rows, and CSV export. Existing server/client actions,
fleet scope, opaque cursor pagination, and row actions remain authoritative. A
`nextCursor` load-more control will append backend pages to the grid; it will not
be converted to offset pagination or enterprise server-side row models.

## Technical Context

**Language/Version**: TypeScript strict, React 19.3, Next.js 16.3 App Router

**Primary Dependencies**: `ag-grid-react` and its `ag-grid-community` peer,
existing Tailwind/shadcn primitives, Zustand filter store, existing `lib/api.ts`
and `lib/actions/*` cursor actions

**Storage**: No new storage. Existing API data, URL/search state, and filter
store/cookie fleet scope are reused.

**Testing**: `pnpm typecheck`, `pnpm lint`, `pnpm build`, plus manual browser
walkthrough against the local backend using the scenarios in `quickstart.md`.

**Target Platform**: Authenticated Arabic RTL web dashboard in modern desktop and
narrow-viewport browsers.

**Project Type**: Next.js web application with server-rendered page shells and
client components for interactive grids.

**Performance Goals**: Search and Community filters update within 1 second for at
least 100 loaded rows on a supported desktop browser; grid controls do not cause
page navigation or layout overlap.

**Constraints**: pnpm only; AG Grid Community Edition only; no enterprise modules,
Excel export, Set Filter, context-menu export, server-side row model, offset
pagination, backend changes, direct browser calls to `BUS_API_URL`, or non-Arabic
operator copy. Grid containers must have stable dimensions.

**Scale/Scope**: All shell collection views: fleet, bus, driver, fleet-owner,
permission, role, trip, booking, user, stop, and trip-line lists, plus related
collections in fleet, bus, booking, driver, fleet-owner, and role detail views.
Form-only pages and ordered stop-editor controls are not ordinary grids.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Super-admin-only access**: PASS. The feature changes presentation only and
  keeps existing `(shell)` proxy/layout guards and row-action permissions.
- **II. Proxy-only access**: PASS. Grids receive data from existing page/action
  boundaries; no grid code receives `BUS_API_URL` or tokens.
- **III. Backend contract fidelity**: PASS. The design keeps `{items,nextCursor}`
  and `عرض المزيد` cursor loading. Client pagination is explicitly limited to
  accumulated rows and is not an API pagination replacement.
- **IV. Arabic-first RTL**: PASS. Grid locale text, labels, accessible names,
  Western digits, direction, and existing visual tokens are part of the shared
  component contract.
- **V. Server-first and trust boundary**: PASS. Server actions/API routes remain
  responsible for fetching and validating data; the grid is an interactive
  client presentation component only.
- **VI. Auditable governance**: PASS. Existing row actions, confirmation dialogs,
  warnings, and mutation feedback remain intact when rendered in action cells.
- **VII. Simplicity and phase gating**: PASS. One shared grid boundary is added;
  no backend or unrelated domain abstraction is introduced.

No constitution violations require complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-ag-grid-tables/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── grid-ui.md
└── tasks.md                 # created by /speckit-tasks, not this plan
```

### Source Code (repository root)

```text
app/(shell)/*/page.tsx                 # list-page integration points
app/(shell)/*/[id]/page.tsx            # detail-page related collections
components/tables/cursor-list.tsx      # existing cursor boundary to replace/adapt
components/tables/ag-grid-table.tsx    # planned shared client grid boundary
components/tables/ag-grid-locale.ts   # planned Arabic Community locale/config
components/fleets/fleet-detail-listings.tsx
components/fleets/members-tab.tsx      # related collection integrations
lib/actions/*.ts                        # existing cursor-page producers
lib/api.ts                              # existing server-side fetch boundary
stores/filters.ts                        # existing module filter/scope state
app/globals.css                          # AG Grid theme/layout overrides
package.json                             # Community package dependency
```

**Structure Decision**: Keep the current single Next.js application and place the
shared interactive grid under `components/tables/`. Domain pages retain ownership
of column definitions, row types, route links, and mutations; the shared component
owns grid configuration, toolbar behavior, CSV export, pagination, cursor append
state, and common empty/loading/error presentation.

## Implementation Approach

1. Add the Community React grid dependencies and register only the modules needed
   for client-side rows, CSV export, pagination, and text/number/date filters.
2. Build a typed client grid boundary with explicit props for row data, column
   definitions, initial cursor, cursor loader, filter/search state, row actions,
   and empty/loading/error states. Use a fixed-height responsive container and the
   existing Arabic design tokens.
3. Add an Arabic locale/configuration layer, toolbar search, export action, and
   cursor load-more control. Ensure CSV export is escaped against formula
   injection and uses visible/exportable columns with Arabic headers.
4. Migrate the shared `CursorList` consumers first, then native tables and card
   collections. Preserve each page's fleet scope, route navigation, mutation
   dialogs, and domain-specific filters. Keep ordered stop editing lists as form
   controls unless they represent a collection view.
5. Remove or retire obsolete list rendering paths only after all in-scope routes
   use the shared grid. Update styles and loading/empty/error states centrally.
6. Validate typecheck, lint, build, and manual workflows for representative and
   full route coverage.

## Complexity Tracking

Not applicable; the design uses one shared presentation boundary and preserves
existing data and mutation abstractions.
