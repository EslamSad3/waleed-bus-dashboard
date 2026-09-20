# Tasks: AG Grid Community Tables

**Input**: Design documents from `specs/002-ag-grid-tables/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md),
[research.md](research.md), [data-model.md](data-model.md),
[contracts/grid-ui.md](contracts/grid-ui.md), [quickstart.md](quickstart.md)

**Tests**: No automated test tasks are included because the feature specification
requests executable manual walkthroughs rather than TDD. Validation is included
in the final polish phase and must use [quickstart.md](quickstart.md).

**Organization**: Tasks are grouped by user story so each story can be implemented
and validated as an incremental slice.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the Community grid dependencies without changing runtime behavior.

- [X] T001 Add `ag-grid-react` and the matching `ag-grid-community` dependency in `package.json` and update `pnpm-lock.yaml` using pnpm only
- [X] T002 [P] Record the Community-only module boundary and grid migration route inventory in `specs/002-ag-grid-tables/contracts/grid-ui.md`

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared client boundary and localization/configuration that
all story integrations depend on.

**Checkpoint**: The shared grid can render typed local rows with Arabic locale,
Community filters, client pagination, and a controlled empty/loading/error state
before domain pages are migrated.

- [X] T003 Create typed Community grid contracts and reusable column/export metadata in `components/tables/ag-grid-types.ts`
- [X] T004 Create the shared client grid component with typed rows, column definitions, stable container sizing, Community module registration, client-side pagination, and empty/loading/error states in `components/tables/ag-grid-table.tsx`
- [X] T005 [P] Create Arabic locale text, Western-number formatting, and Community filter defaults in `components/tables/ag-grid-locale.ts`
- [X] T006 [P] Add AG Grid theme imports, RTL direction, responsive overflow, stable row/toolbar dimensions, and visible focus styles in `app/globals.css`
- [X] T007 Adapt `components/tables/cursor-list.tsx` to preserve the existing `{items,nextCursor}` and `loadMore` contract while delegating collection rendering to `components/tables/ag-grid-table.tsx`

## Phase 3: User Story 1 - Consistent Data Tables (Priority: P1) 🎯 MVP

**Goal**: Every in-scope shell collection and related-record collection uses the
shared Arabic AG Grid pattern with search, column filters, pagination, empty/error
states, and preserved row actions.

**Independent Test**: Open every migrated route listed below, confirm the shared
grid renders its records, search and applicable column filters update loaded rows,
client pagination changes pages without navigation, and existing row links/actions
still work.

### Implementation for User Story 1

- [X] T008 [P] [US1] Migrate fleet, bus, fleet-owner, role, permission, trip, and user list pages to typed grid columns while preserving scope, links, and mutations in `app/(shell)/fleets/page.tsx`, `app/(shell)/buses/page.tsx`, `app/(shell)/fleet-owners/page.tsx`, `app/(shell)/roles/page.tsx`, `app/(shell)/permissions/page.tsx`, `app/(shell)/trips/page.tsx`, and `app/(shell)/users/page.tsx`
- [X] T009 [P] [US1] Migrate the drivers list and its status/search/action cells to the shared grid in `app/(shell)/drivers/page.tsx`
- [X] T010 [P] [US1] Migrate stops and trip-lines collection views to typed grids while retaining inline edit/delete and route-specific actions in `app/(shell)/stops/page.tsx` and `app/(shell)/trip-lines/page.tsx`
- [X] T011 [US1] Migrate the bookings collection view to the shared grid, preserving fleet/global filters, booking actions, cursor loading, and detail links in `app/(shell)/bookings/page.tsx`
- [X] T012 [P] [US1] Migrate fleet detail related collections and members to grids while preserving tabs, scope, member warnings, and row actions in `components/fleets/fleet-detail-listings.tsx` and `components/fleets/members-tab.tsx`
- [X] T013 [P] [US1] Migrate bus, booking, driver, fleet-owner, and role detail related collections to grids while preserving detail navigation and mutation dialogs in `app/(shell)/buses/[id]/page.tsx`, `app/(shell)/bookings/[id]/page.tsx`, `app/(shell)/drivers/[id]/page.tsx`, `app/(shell)/fleet-owners/[id]/page.tsx`, and `app/(shell)/roles/[id]/page.tsx`
- [X] T014 [US1] Update all migrated page-level column definitions and collection empty states to use Arabic headers, typed text/number/date filters, Western digits, stable action columns, and the `AgGridTable` contract in the files changed by T008-T013

**Checkpoint**: All in-scope record collections render through the shared grid;
form-only pages and ordered stop-editor controls remain intentionally unchanged.

## Phase 4: User Story 2 - Export and Page Through Results (Priority: P1)

**Goal**: Every exportable grid supports safe CSV export and every cursor-backed
grid supports loading additional backend pages without breaking client pagination,
filters, or current rows.

**Independent Test**: On a multi-page collection, search/filter rows, change page
size, export CSV, load another cursor page, and verify the appended matching rows,
Arabic values, Western digits, and exportable columns.

### Implementation for User Story 2

- [X] T015 [US2] Add the Arabic toolbar search, Community filter controls, page-size selector, pagination labels, and CSV export action to `components/tables/ag-grid-table.tsx`
- [X] T016 [US2] Implement safe Community CSV export with visible/exportable column selection, Arabic filename/header handling, UTF-8 output, and formula-prefix neutralization in `components/tables/ag-grid-table.tsx` and `components/tables/ag-grid-types.ts`
- [X] T017 [US2] Implement cursor load-more state transitions that append `{items,nextCursor}`, preserve search/filter/page state, retain rows on failure, and expose retryable Arabic feedback in `components/tables/ag-grid-table.tsx` and `components/tables/cursor-list.tsx`
- [X] T018 [P] [US2] Wire full-array collections without cursors to the same export/search/filter/page behavior and omit load-more in `app/(shell)/stops/page.tsx`, `app/(shell)/trip-lines/page.tsx`, `app/(shell)/permissions/page.tsx`, and `components/fleets/fleet-detail-listings.tsx`
- [X] T019 [US2] Verify cursor-backed actions and fleet scope remain unchanged while all migrated grids consume existing `lib/actions/*.ts`, `lib/api.ts`, and `stores/filters.ts` boundaries; adjust only page adapters in the affected grid consumers

**Checkpoint**: CSV export, client pagination, and cursor append work on both
cursor-backed and full-array grids without offset pagination or backend changes.

## Phase 5: User Story 3 - Predictable RTL and Responsive Interaction (Priority: P2)

**Goal**: The shared grid remains readable, keyboard reachable, and non-overlapping
on Arabic RTL desktop and narrow viewports.

**Independent Test**: Walk representative fleet, bus, trip, booking, and user grids
at desktop and narrow widths using keyboard navigation; confirm visible focus,
Arabic accessible names, bounded horizontal overflow, and no overlapping controls.

### Implementation for User Story 3

- [X] T020 [US3] Configure Arabic AG Grid locale text, RTL direction, filter labels, pagination announcements, export/load-more labels, and Arabic accessible names in `components/tables/ag-grid-locale.ts` and `components/tables/ag-grid-table.tsx`
- [X] T021 [US3] Tune responsive grid container, toolbar, column minimum widths, row heights, horizontal overflow, pagination panel, and visible focus styles in `app/globals.css`
- [X] T022 [P] [US3] Review every migrated action column for keyboard-reachable links/buttons, visible focus, Arabic labels, and preserved confirmation flows in `app/(shell)/fleets/page.tsx`, `app/(shell)/buses/page.tsx`, `app/(shell)/drivers/page.tsx`, `app/(shell)/trips/page.tsx`, `app/(shell)/bookings/page.tsx`, and `app/(shell)/users/page.tsx`
- [X] T023 [US3] Verify detail-page related grids and empty/loading/error states at narrow widths, adjusting only their adapters and shared styles in `components/fleets/fleet-detail-listings.tsx`, `components/fleets/members-tab.tsx`, `app/(shell)/buses/[id]/page.tsx`, and `app/(shell)/bookings/[id]/page.tsx`

**Checkpoint**: Representative desktop, narrow viewport, and keyboard walkthroughs
pass without layout overlap or inaccessible required action.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete migration and leave the repository with no
obsolete in-scope table/list rendering paths.

- [X] T024 [P] Remove obsolete in-scope hand-built list/table rendering and unused imports after migration in `components/tables/cursor-list.tsx` and all files changed by T008-T013
- [X] T025 [P] Review Community package usage and imports to ensure no `ag-grid-enterprise`, enterprise-only module, Excel export, context-menu export, or server-side row model appears in `package.json`, `pnpm-lock.yaml`, or `components/tables/`
- [X] T026 Run `pnpm typecheck` and resolve AG Grid TypeScript errors introduced by the migration across `components/tables/`, `components/fleets/`, `app/(shell)/`, and `lib/`
- [X] T027 Run `pnpm lint` and resolve lint errors introduced by the migration while documenting unrelated baseline failures in `PROGRESS.md`
- [X] T028 Run `pnpm build` and verify the client/server boundary does not expose `BUS_API_URL` or session tokens in the client bundle in `.next/` and affected app components
- [X] T029 Execute all representative browser scenarios in `specs/002-ag-grid-tables/quickstart.md` against the local backend and record the result in `PROGRESS.md`
- [X] T030 Confirm `specs/002-ag-grid-tables/spec.md` FR-001 through FR-012 and SC-001 through SC-005 are covered by the final implementation and update `specs/002-ag-grid-tables/checklists/requirements.md` only if the requirements wording changes

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T001 and T002 can run in parallel.
- **Foundational (Phase 2)**: Depends on T001; T003-T006 can proceed in parallel,
  then T007 depends on the shared component and types.
- **User Story 1 (Phase 3)**: Depends on Phase 2; T008-T013 can proceed in
  parallel by route group, then T014 consolidates column/empty-state conventions.
- **User Story 2 (Phase 4)**: Depends on Phase 3 because export/load-more behavior
  must be wired to every migrated consumer; T018 can run in parallel with T015-T017.
- **User Story 3 (Phase 5)**: Depends on Phase 4; T020-T023 share the component
  contract but can be split by locale/styles/page review.
- **Polish (Phase 6)**: Depends on all desired story checkpoints.

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational; no other user story dependency. This is the MVP.
- **US2 (P1)**: Depends on US1's migrated consumers so one shared export/load-more
  implementation can be validated across all grids.
- **US3 (P2)**: Depends on US1 and US2 because accessibility and responsive review
  covers the final grid toolbar, pagination, export, and cursor controls.

## Parallel Opportunities

- **Setup**: T001 and T002 are independent.
- **Foundation**: T003, T005, and T006 can run in parallel after dependency setup;
  T004 follows T003, and T007 follows T004.
- **US1 route migration**: T008, T009, T010, T012, and T013 can run in parallel;
  T011 is isolated enough to run in parallel but is listed separately because
  bookings has broader filter/cursor behavior.
- **US2**: T018 can run in parallel with T015-T017 after US1; T016 and T017 touch
  the same shared component and should be sequenced by one implementer.
- **US3**: T021 and T022 can run in parallel after T020; T023 can follow the shared
  style changes.
- **Polish**: T024, T025, and T026 can begin in parallel once the final migration
  lands; T027/T028 follow code stabilization, and T029/T030 follow all checks.

## Parallel Example: User Story 1

```text
Task A: T008 migrate CursorList-based primary list pages
Task B: T009 migrate drivers native table
Task C: T010 migrate stops and trip-lines collections
Task D: T012 migrate fleet detail listings and members
Task E: T013 migrate detail-page related collections
```

## Parallel Example: User Story 2

```text
Task A: T015 add shared toolbar and pagination controls
Task B: T018 adapt full-array collections to the shared export behavior
Task C: T019 verify existing action, scope, and filter boundaries
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational phases.
2. Migrate every in-scope collection through US1.
3. Stop at the US1 checkpoint and run its independent walkthrough.
4. Continue to US2 only after consistent grid rendering is verified.

### Incremental Delivery

1. Deliver the shared grid foundation.
2. Deliver US1 route coverage as the first usable increment.
3. Deliver US2 safe export and cursor append behavior.
4. Deliver US3 responsive and keyboard polish.
5. Run the complete quickstart and quality gates before closing the feature.

## Notes

- Every task uses the required `- [ ] T###` checklist form.
- `[P]` appears only where files and dependencies permit parallel work.
- `[US1]`, `[US2]`, and `[US3]` map directly to the feature specification stories.
- No backend API or data model changes are planned.
