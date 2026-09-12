# Tasks: P1 Platform CRUD (001-platform-crud)

**Input**: Design documents from `specs/001-platform-crud/` (plan.md, spec.md US1–US5, data-model.md, contracts/, research.md R1–R7, quickstart.md)

**Prerequisites**: P0 gate PASS (proxy, guard, error map, copy deck exist). Backend untouched.

**Tests**: None wired (spec mandates manual walkthrough gates per story + `tsc --noEmit` + eslint).

**Organization**: By user story; each story independently testable after Foundational.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependencies)
- **[Story]**: US1–US5 maps to spec.md stories

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Toolchain + contract freshness before any code

- [X] T001 Verify P1 contract freshness: diff `contracts/p1-resources.openapi.yaml` paths against `D:/Eslam/waleed/bus/bus_api/docs/openapi.json`; record drift (or "clean") at top of `specs/001-platform-crud/contracts/p1-resources.openapi.yaml`
- [X] T002 [P] Verify toolchain in `bus_dashboard/package.json` (`pnpm install` state, `./node_modules/.bin/tsc --version`) and that `bus_api` runs locally with seeded super_admin; record ports in `specs/001-platform-crud/quickstart.md` header if changed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared P1 infrastructure — MUST complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Create P1 zod schema registry in `bus_dashboard/lib/schemas/p1.ts` (Create/Update/Add/Assign schemas per `contracts/p1-resources.openapi.yaml`, keyed by method + path pattern)
- [X] T004 [P] Extend error map in `bus_dashboard/lib/errors.ts` and merge `specs/001-platform-crud/contracts/error-map-additions.ar-EG.json` into `specs/000-p0-scaffold/contracts/error-map.ar-EG.json` (new code keys + per-screen `CONFLICT` context support + `RATE_LIMITED` fix)
- [X] T005 [P] Hook registry validation into `bus_dashboard/app/api/[...proxy]/route.ts` (re-validate mutations via `lib/schemas/p1.ts` before forwarding; map `details.fields` to fields)
- [X] T006 [P] Build fleet-scope selector in `bus_dashboard/components/fleet-scope-select.tsx` (populated from `GET /fleets`, writes `stores/filters.ts` + cookie) and wire into shell topbar/sidebar
- [X] T007 [P] Build shared cursor-list primitives in `bus_dashboard/components/tables/cursor-list.tsx` ("عرض المزيد" load-more, `limit=20`, empty-state pattern, Western digits)
- [X] T008 [P] Extend P1 Arabic strings in `bus_dashboard/specs/dashboard/copy-ar-EG.md` (module titles, actions, confirmations, warnings, 409/404 messages per FR-024)
- [X] T009 [P] Extend per-list UI filters in `bus_dashboard/stores/filters.ts` (fleetId + search/status/date filter state per module)
- [X] T010 [P] Add P1 module nav entries (fleets, buses, trips, bookings, drivers) in `bus_dashboard/components/shell/sidebar.tsx`

**Checkpoint**: Foundation ready — registry validates, scope selector persists, lists render; user stories can now begin (sequentially P1→P2 or in parallel if staffed)

---

## Phase 3: User Story 1 — Fleet management (Priority: P1) 🎯 MVP

**Goal**: Full fleet CRUD (list/search/filter/load-more, create with owner picker, tabbed detail, edit/activate, guarded delete)

**Independent Test**: Quickstart "Fleets" block: create → rename → deactivate → delete-empty (confirm) → delete-referenced → Arabic 409, fleet kept; zero raw codes

### Implementation for User Story 1

- [X] T011 [P] [US1] Fleet list page in `bus_dashboard/app/(shell)/fleets/page.tsx` (search, active filter, cursor load-more via `components/tables/cursor-list.tsx`)
- [X] T012 [P] [US1] Fleet create page in `bus_dashboard/app/(shell)/fleets/new/page.tsx` (name + owner picker from `GET /users` + optional ownerRoleSlug)
- [X] T013 [P] [US1] Fleet detail + tabs in `bus_dashboard/app/(shell)/fleets/[id]/page.tsx` (Overview · Buses · Trips · Members · Bookings · Reports-forward-link; edit + activate toggle + delete-with-confirm)
- [X] T014 [US1] Fleet server actions in `bus_dashboard/lib/actions/fleets.ts` (create/update/delete via `/api/*`, toasts name the audited action, 409-referenced maps to fleet message)

**Checkpoint**: US1 fully functional and testable independently (all other modules still absent)

---

## Phase 4: User Story 2 — Bus management + per-bus trips (Priority: P1)

**Goal**: Per-fleet bus CRUD + disable/reactivate + driver assign/unassign + per-bus trips tab, platform-first with tenant actions

**Independent Test**: Quickstart "Buses" block incl. duplicate-registration, DEPARTED-blocked disable, idempotent re-assign, trips tab

### Implementation for User Story 2

- [X] T015 [P] [US2] Bus list page in `bus_dashboard/app/(shell)/buses/page.tsx` (fleet scope–driven, cursor-paged)
- [X] T016 [P] [US2] Bus create page in `bus_dashboard/app/(shell)/buses/new/page.tsx` (registration/plate/capacity, duplicate → "رقم التسجيل مستخدم قبل كده")
- [X] T017 [P] [US2] Bus detail + trips tab in `bus_dashboard/app/(shell)/buses/[id]/page.tsx` (edit plate/capacity, disable/reactivate with 409 message, assign/unassign driver, per-bus trips via tenant path)
- [X] T018 [US2] Bus server actions in `bus_dashboard/lib/actions/buses.ts` (CRUD + lifecycle + assignment, `x-fleet-id` on tenant calls, toasts name the action)

**Checkpoint**: US1 + US2 both work independently (bus screens need only a fleet id, satisfiable via scope selector)

---

## Phase 5: User Story 3 — Trip management (Priority: P2)

**Goal**: Per-fleet trip CRUD with filters, same-fleet bus enforcement, status moves + cancel + guarded delete

**Independent Test**: Quickstart "Trips" block incl. cross-fleet bus 404, SCHEDULED→DEPARTED→COMPLETED, cancel-via-PATCH, delete-with-confirm

### Implementation for User Story 3

- [X] T019 [P] [US3] Trip list page in `bus_dashboard/app/(shell)/trips/page.tsx` (status/route/date filters over loaded pages per R4)
- [X] T020 [P] [US3] Trip create page in `bus_dashboard/app/(shell)/trips/new/page.tsx` (same-fleet bus picker, origin/destination, departAt)
- [X] T021 [P] [US3] Trip detail page in `bus_dashboard/app/(shell)/trips/[id]/page.tsx` (route, bus link, schedule, status timeline, bookings-manifest link, status move, cancel, delete-with-confirm)
- [X] T022 [US3] Trip server actions in `bus_dashboard/lib/actions/trips.ts` (CRUD + status transitions, toasts name the action)

**Checkpoint**: US1–US3 independently functional

---

## Phase 6: User Story 4 — Booking management (Priority: P2)

**Goal**: Per-fleet booking CRUD with filters + passenger search, detail timeline + ratings, cancel + guarded delete

**Independent Test**: Quickstart "Bookings" block incl. missing-name inline error, phone search with Western digits, cancel-with-confirm, cross-fleet trip 404

### Implementation for User Story 4

- [X] T023 [P] [US4] Booking list page in `bus_dashboard/app/(shell)/bookings/page.tsx` (trip/status/payment filters + passenger search over loaded pages)
- [X] T024 [P] [US4] Booking create page in `bus_dashboard/app/(shell)/bookings/new/page.tsx` (same-fleet trip picker, required passengerName)
- [X] T025 [P] [US4] Booking detail page in `bus_dashboard/app/(shell)/bookings/[id]/page.tsx` (passenger, trip link, status/payment timeline, ratings read-only, edit, cancel-with-confirm, delete-with-confirm)
- [X] T026 [US4] Booking server actions in `bus_dashboard/lib/actions/bookings.ts` (CRUD + cancel, toasts name the action)

**Checkpoint**: US1–US4 independently functional

---

## Phase 7: User Story 5 — Fleet membership + drivers roster (Priority: P2)

**Goal**: Fleet Members tab (add/change/remove with revocation warnings) + `/drivers` roster (list, existing-or-fresh invite, detail/history, change/remove)

**Independent Test**: Quickstart "Members + roster" block incl. duplicate-add conflict, suspend-with-warning, fresh-credential invite ACTIVE, assignment history, cross-fleet 404

### Implementation for User Story 5

- [X] T027 [P] [US5] Fleet members tab in `bus_dashboard/components/fleets/members-tab.tsx` (list, add-existing-user, role/status change + warning, remove + confirm; embedded in `app/(shell)/fleets/[id]/page.tsx`)
- [X] T028 [P] [US5] Drivers roster page in `bus_dashboard/app/(shell)/drivers/page.tsx` (tenant list, search/verified/active filters, invite existing-user or fresh phone+name+password)
- [X] T029 [P] [US5] Driver detail page in `bus_dashboard/app/(shell)/drivers/[id]/page.tsx` (membership, ACTIVE/ENDED assignment history, role/status change + warning, remove + confirm)
- [X] T030 [US5] Member + driver server actions in `bus_dashboard/lib/actions/members.ts` (membership CRUD + roster invite/update/remove, revocation warnings, toasts name the action)

**Checkpoint**: All five stories independently functional; P1 scope complete

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Gates, docs, final verification

- [X] T031 Run `tsc --noEmit` + eslint clean in `bus_dashboard/` (`./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/eslint`); fix all findings
- [X] T032 Execute `specs/001-platform-crud/quickstart.md` walkthrough against local `bus_api`, record PASS/FAIL per item in `bus_dashboard/PROGRESS.md` (P1 gate row), and verify no `BUS_API_URL`/tokens in the client bundle

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately (T001, T002 [P] in parallel)
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (T004–T010 [P] in parallel after/around T003; T005 needs T003's registry shape — coordinate, don't duplicate)
- **User Stories (Phases 3–7)**: All depend on Foundational only — then proceed sequentially (US1→US5) or in parallel if staffed
- **Polish (Phase 8)**: Depends on all stories complete

### User Story Dependencies

- **US1 Fleets (P1)**: After Foundational — no story dependencies (MVP)
- **US2 Buses (P1)**: After Foundational — needs only a fleet id (scope selector/seed); detail tabs link to US3–US5 pages when they exist, degrade gracefully before
- **US3 Trips (P2)**: After Foundational — needs a bus id (seed or US2); links to US4 manifest when it exists
- **US4 Bookings (P2)**: After Foundational — needs a trip id (seed or US3)
- **US5 Members/Roster (P2)**: After Foundational — needs user/role reads (`GET /users`, `GET /roles` reused read-only); US2 assignment UI consumes memberships when present

### Within Each User Story

- Pages (list/new/detail) are independent files → build in parallel
- `lib/actions/<module>.ts` last per story (consumes the story's page contracts)
- Story complete → run its quickstart block before moving on

### Parallel Opportunities

- T002 with T001; T004–T010 (7 tasks) in parallel (T005 coordinates with T003's registry key format)
- T011–T013 in parallel; T015–T017 in parallel; T019–T021 in parallel; T023–T025 in parallel; T027–T029 in parallel
- After Foundational, US1–US5 can run in parallel across workers (19 story tasks, no shared files except per-story `lib/actions/*`)

---

## Parallel Example: User Story 1

```bash
# Launch all US1 pages together (different files, no dependencies):
Task: "Fleet list page in bus_dashboard/app/(shell)/fleets/page.tsx"
Task: "Fleet create page in bus_dashboard/app/(shell)/fleets/new/page.tsx"
Task: "Fleet detail + tabs in bus_dashboard/app/(shell)/fleets/[id]/page.tsx"
# Then: Task: "Fleet server actions in bus_dashboard/lib/actions/fleets.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T010, CRITICAL — blocks all stories)
3. Complete Phase 3: US1 Fleets (T011–T014)
4. **STOP and VALIDATE**: quickstart "Fleets" block independently
5. Demo if ready (fleet CRUD = vertical slice through proxy + registry + error map + scope)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. + US1 → test → MVP (fleets)
3. + US2 → test (buses + lifecycle)
4. + US3 → test (trips) → + US4 → test (bookings) → + US5 → test (members/roster)
5. Polish → P1 gate recorded → P2

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Once Foundational is done: A → US1+US2, B → US3+US4, C → US5, then swarm Polish
3. Stories integrate via links only (fleet tabs, bus/trip cross-links) — no shared-file conflicts

---

## Notes

- [P] tasks = different files, no dependencies
- [USn] label maps task to spec.md story for traceability
- No test tasks: spec mandates manual walkthrough gates (quickstart.md blocks per story)
- Backend stays untouched — missing capabilities become `bus_api` change requests
- After_tasks hooks: none (no `.specify/extensions.yml` in repo — checked, skipped silently)
