# Feature Specification: AG Grid Community Tables

**Feature Branch**: `002-ag-grid-tables`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "in all pages use ag grid table community edition with export, search, filters and pagination"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Consistent data tables (Priority: P1)

As a super-admin, I want every shell page that displays tabular records to use
the same searchable, filterable, paginated table so that I can scan and manage
fleets, buses, drivers, trips, bookings, users, roles, permissions, stops, and
other list data consistently.

**Why this priority**: Tables are the primary navigation and management surface
for the dashboard; inconsistent table behavior slows every operational workflow.

**Independent Test**: Open each shell route that presents a record collection and
verify that its data is rendered in the shared grid pattern with search, filters,
pagination, and export available where the data is exportable.

**Acceptance Scenarios**:

1. **Given** a shell page with tabular records, **When** the page loads, **Then**
  records appear in the standard Arabic RTL data-grid layout with stable columns,
  loading state, empty state, and error state.
2. **Given** a grid containing records, **When** the operator enters a search
  term, **Then** only matching loaded records remain visible and the result
  count/page state updates without losing the current fleet scope.
3. **Given** a grid with filterable columns, **When** the operator applies or
  clears a column filter, **Then** the visible rows update and the active filter
  state is apparent.

---

### User Story 2 - Export and page through results (Priority: P1)

As a super-admin, I want to export the records currently available in a table
and move through manageable pages of rows so that I can review or share data
without losing the dashboard's cursor-based backend behavior.

**Why this priority**: Export and pagination are requested capabilities and are
needed for practical use of large operational lists.

**Independent Test**: Load a multi-page dataset, change page size and pages, use
the export action, and verify that the downloaded CSV contains the expected
loaded rows and visible column values.

**Acceptance Scenarios**:

1. **Given** more rows than the selected page size, **When** the operator changes
  pages or page size, **Then** the grid shows the corresponding loaded rows
  without a full-page navigation.
2. **Given** rows are visible in a grid, **When** the operator chooses export,
  **Then** a CSV file downloads using the current columns and loaded row data,
  including Western digits and Arabic text correctly.
3. **Given** the backend returns a next cursor, **When** the operator requests
  more records, **Then** the next cursor page is appended to the grid and the
  existing search, filters, and page position remain usable.

---

### User Story 3 - Predictable RTL and responsive interaction (Priority: P2)

As a super-admin using Arabic RTL screens on desktop or a narrow viewport, I want
the grid controls, columns, and empty/loading states to remain understandable
and usable without overlapping content.

**Why this priority**: The dashboard is Arabic-first and the table is shared by
many workflows, so a layout failure affects the whole application.

**Independent Test**: Inspect a representative list at desktop and narrow widths,
use keyboard focus through search, filters, pagination, and export, and verify
that labels and grid direction remain Arabic RTL.

**Acceptance Scenarios**:

1. **Given** an Arabic shell page, **When** the grid renders, **Then** its labels,
  controls, and status values follow the page's RTL direction and Arabic copy
  conventions while table digits remain Western digits.
2. **Given** a narrow viewport, **When** the operator views a wide dataset,
  **Then** the grid remains usable through bounded horizontal scrolling and no
  control or cell text overlaps unrelated content.
3. **Given** a keyboard-only operator, **When** focus moves through grid controls,
  **Then** search, filters, pagination, export, and row actions are reachable
  with visible focus and Arabic accessible names.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- An empty result set shows the established Arabic empty-state message and
  primary action instead of a blank grid.
- A loading or failed cursor request preserves already loaded rows and shows a
  visible loading or Arabic error state; it does not reset filters silently.
- A dataset with no `nextCursor` disables or hides the load-more action while
  grid pagination still works across loaded rows.
- Search and column filters apply to loaded rows; requesting another cursor page
  appends rows and reapplies the active view state.
- Export with no matching rows downloads a valid CSV with headers only or shows
  the established no-results feedback, consistently across all grids.
- Long Arabic values, missing optional values, dates, and Western digits remain
  readable without changing column or toolbar dimensions unexpectedly.
- Detail pages may contain read-only related-record grids; form-only pages do
  not require a grid when no collection is displayed.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST render every shell-page record collection, including
  related-record collections on detail pages, with the shared AG Grid Community
  Edition table pattern; form-only pages are out of scope.
- **FR-002**: System MUST provide a global text search control for each grid that
  searches the loaded row values and updates the visible result set without a
  network request.
- **FR-003**: System MUST provide column filters appropriate to each field type,
  including text, status/category, date, and numeric values where applicable.
- **FR-004**: System MUST provide client-side grid pagination with a visible
  current page, page-size selection, and navigation controls for loaded rows.
- **FR-005**: System MUST preserve backend cursor pagination: cursor requests
  use the existing `{items, nextCursor}` contract and a load-more action appends
  records rather than converting the API to offset pagination or page counts.
- **FR-006**: System MUST provide CSV export for every exportable grid using the
  current column definitions and currently loaded rows, including Arabic text,
  Western digits, and visible field formatting.
- **FR-007**: System MUST keep the grid usable in Arabic RTL, with Arabic labels,
  tooltips, empty/error/loading copy, and accessible names; no English-only table
  controls may be exposed to operators.
- **FR-008**: System MUST preserve existing fleet scope, route, permission, and
  cursor behavior while replacing hand-built record tables; it MUST NOT expose
  backend URLs or session tokens to the browser.
- **FR-009**: System MUST provide stable column sizing and responsive overflow so
  loading text, filters, pagination, exports, and row actions do not cause layout
  shifts or overlap.
- **FR-010**: System MUST retain row-level links and actions, including detail,
  edit, and destructive-action confirmation flows, when a grid replaces a table.
- **FR-011**: System MUST make all grid controls keyboard reachable with visible
  focus and Arabic accessible names.
- **FR-012**: System MUST use only Community Edition capabilities and MUST NOT
  require enterprise licensing or enterprise-only modules.

### Key Entities

- **Grid View**: A shell or detail-page collection with column definitions,
  loaded records, search text, active column filters, page size, and current page.
- **Loaded Record Set**: The rows received from one or more cursor pages and
  currently available to search, filter, paginate, and export.
- **Cursor Page**: Backend response containing `items` and an opaque
  `nextCursor`; it is appended to a grid without changing the API contract.
- **Export File**: A CSV representation of the grid's loaded rows and current
  exportable columns.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: 100% of shell pages that display a record collection use the shared
  grid pattern; no in-scope page retains a hand-built data table.
- **SC-002**: An operator can search, apply a column filter, change page, load
  more cursor results, and export CSV from each representative grid without a
  full-page navigation.
- **SC-003**: For a dataset of at least 100 loaded rows, search and filter results
  update within 1 second on a supported desktop browser.
- **SC-004**: CSV export contains all loaded matching rows and the displayed
  exportable columns, with Arabic text and Western digits preserved.
- **SC-005**: Keyboard and narrow-viewport walkthroughs pass for representative
  fleet, bus, trip, booking, and user grids with no overlapping controls or
  inaccessible required action.

## Assumptions

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right assumptions based on reasonable defaults
  chosen when the feature description did not specify certain details.
-->

- AG Grid Community Edition is acceptable for the shared table behavior and CSV
  export; enterprise-only features such as Excel export, server-side row model,
  pivoting, and advanced grouping are out of scope.
- Grid search, filters, pagination, and export operate on rows loaded in the
  browser; backend filtering is not invented where the API lacks it.
- Cursor pagination remains the source of truth for fetching more data, with
  client-side grid pagination layered over loaded rows.
- Existing authentication, fleet scope, API proxy, Arabic copy, and backend
  contracts are reused unchanged.
- Supported desktop and narrow viewport behavior means responsive horizontal
  overflow, not a separate mobile table implementation.
