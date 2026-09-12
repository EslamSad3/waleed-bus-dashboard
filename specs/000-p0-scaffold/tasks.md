---

description: "Task list for P0 scaffold (000-p0-scaffold)"
---

# Tasks: P0 Scaffold — shell, theme, login, proxy, session, pdfkit spike

**Input**: Design documents from `specs/000-p0-scaffold/` (plan.md required; spec.md required;
research.md, data-model.md, contracts/, quickstart.md consulted)

**Prerequisites**: plan.md ✓, spec.md ✓ (clarified 2026-09-11: spike-FAIL gate, proxy breadth,
rememberMe, visual PASS), research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: No automated test runner is wired in the dashboard yet (plan.md: manual walkthrough +
`tsc --noEmit` + eslint; test-runner decision deferred to P4). No test tasks generated.
Each story carries its Independent Test from spec.md as a manual gate instead.

**Organization**: Tasks grouped by user story; each story independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single Next.js project at repo root (`bus_dashboard/`): `app/`, `lib/`, `components/`, `stores/`
- Backend lives in sibling `bus_api/` and MUST NOT be touched (spec FR-010)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Scaffold Next.js@latest App Router + TypeScript strict + Tailwind app in `bus_dashboard/` (pnpm, Node 24)
- [X] T002 [P] Initialize shadcn `new-york` + `lucide-react` in `components/ui/` with PRD §3 theme mapping in `app/globals.css`
- [X] T003 [P] Install runtime deps with pnpm: `zod`, `@hookform/resolvers`, `react-hook-form`, `zustand`, `pdfkit`, `bidi-shaper` (+ `@types/pdfkit` dev) in `package.json`
- [X] T004 [P] Create `.env.example` (`BUS_API_URL`, `SESSION_COOKIE_SECRET`, `PDF_FONT_PATH`, `NEXT_PUBLIC_APP_NAME`) and gitignore `.env*` in `bus_dashboard/`
- [X] T005 Configure eslint (`eslint-config-next`) + `tsc --noEmit` baseline in `bus_dashboard/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 [P] Implement Egyptian-Arabic error map in `lib/errors.ts` from `specs/000-p0-scaffold/contracts/error-map.ar-EG.json` (PRD §9; unknown codes → generic fallback)
- [X] T007 [P] Create shared login zod schema in `lib/schemas/auth.ts` (email, password min 8, rememberMe default false; no `loginType`)
- [X] T008 Implement generic BFF forwarder in `app/api/[...proxy]/route.ts` + server helper in `lib/api.ts` (JWT attach from httpOnly cookie, `{statusCode,data}` unwrap-once, §9 map, single-flight `POST /auth/refresh` retry-once, `Origin` check on mutations, `no-store` GETs, zod re-validation)
- [X] T009 [P] Create zustand stores in `stores/session.ts` (`{id,email,appRole}`) and `stores/filters.ts` (fleet-scope + cookie → `x-fleet-id`)
- [X] T010 [P] Implement optimistic auth guard in `proxy.ts` (matcher excludes `api|_next|static|images`; cookie-presence redirect `/login`)
- [X] T011 Implement root RTL shell in `app/layout.tsx` (`lang="ar" dir="rtl"`, Cairo + Poppins via `next/font/google`, page gradient token) and global skeleton in `app/loading.tsx`

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 — Super-admin login/logout (Priority: P1)

**Goal**: Only `super_admin` passes login; everyone else gets the generic error; logout clears cookies

**Independent Test**: Vs local `bus_api`: valid super_admin → `/`; wrong/non-super_admin → "بيانات الدخول غير صحيحة", no session; logout → `/login`; anonymous `(shell)` URL → `/login`; 429/offline → throttled/network copy (spec US1 scenarios 1–4)

- [X] T012 [US1] Build login form in `app/(auth)/login/page.tsx` (react-hook-form + shadcn `ui/form` + shared zod schema, show/hide toggle, "تذكرني" checkbox, inline Egyptian-Arabic errors, `details.fields` mapping)
- [X] T013 [US1] Implement authoritative shell guard in `app/(shell)/layout.tsx` (`GET /auth/me` → `appRole === 'super_admin'`, else `/login`)
- [X] T014 [US1] Wire login/logout cookie handling in `lib/auth.ts` (login proxies `POST /auth/login`, sets httpOnly access+refresh; rememberMe: unchecked → session cookie, checked → 7-day persistent refresh; logout proxies `POST /auth/logout` + clears cookies; hydrate zustand via `GET /auth/me`)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently (SC-001)

---

## Phase 4: User Story 2 — Proxied API access + health (Priority: P1)

**Goal**: Same-origin `/api/*` proxy proved via health; refresh-retry and no-leak guarantees verified

**Independent Test**: `GET /api/health` → backend `{status:'ok'}` with no secret leakage; expired access + valid refresh recovers once silently; dead refresh → cookies cleared, 401, `/login` (spec US2 scenarios 1–3)

- [X] T015 [US2] Expose health proxy in `app/api/health/route.ts` (`GET /health` passthrough via `lib/api.ts`)
- [X] T016 [US2] Harden single-flight refresh + 401 cookie-clearing path in `app/api/[...proxy]/route.ts` (retry-once, then clear cookies → 401)
- [X] T017 [P] [US2] Verify no secret leakage: search client bundle + responses for `BUS_API_URL`/JWTs and document result in `PROGRESS.md`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently (SC-001 + SC-002)

---

## Phase 5: User Story 3 — RTL shell with arrw identity (Priority: P2)

**Goal**: arrw-clone shell skeleton (sidebar/topbar, gradient headline, tinted KPI cards, navy CTA band) with a11y + skeletons

**Independent Test**: Visual pass — `<html lang="ar" dir="rtl">`, Cairo/Poppins, gradient headline + tinted cards + navy band per PRD §3; keyboard nav + Arabic `aria-label`s; `loading.tsx` on slow nav (spec US3 scenarios 1–2)

- [X] T018 [P] [US3] Build sidebar + topbar shell components in `components/shell/` (light theme, dark text, active-nav `#2f719e`, Arabic labels)
- [X] T019 [P] [US3] Build overview skeleton page in `app/(shell)/page.tsx` (gradient headline, KPI card row alternating amber/blue tints, navy CTA band, gray footer line)
- [X] T020 [US3] Add Arabic `aria-label`s, focus-visible rings, and per-segment loading skeletons for `(shell)` routes in `app/(shell)/`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: User Story 4 — pdfkit Arabic-shaping spike (Priority: P1, blocking)

**Goal**: Prove correct Arabic shaping in pdfkit before anything depends on it; record explicit PASS/FAIL + fallback decision

**Independent Test**: Human visual inspection — download spike PDF, open it, verify joined Arabic + RTL order + digits; record PASS/FAIL in P0 gate (on FAIL: P0 passes conditionally, proven PDF path becomes P3 entry gate)

- [X] T021 [US4] Implement spike generator in `lib/pdf/spike.ts` (pdfkit + embedded Cairo from `PDF_FONT_PATH` + `bidi-shaper/pdfkit` `textBidi`, `direction:rtl`, prose + digits/mixed + table-header lines)
- [X] T022 [US4] Expose spike route in `app/api/reports/spike/route.ts` (filename `تقرير-spike-<date>.pdf`)
- [X] T023 [US4] Run visual inspection, record explicit PASS/FAIL + (on FAIL) HTML-fallback decision in `PROGRESS.md`

**Checkpoint**: Spike verdict recorded (SC-003); on FAIL, P3 entry gate noted

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Gates, copy deck, and docs that close P0

- [X] T024 Author Egyptian-Arabic copy deck at `specs/dashboard/copy-ar-EG.md` (PRD §10: login/proxy/shell strings used in P0)
- [X] T025 Run `tsc --noEmit` + eslint clean in `bus_dashboard/` and fix all findings (SC-004)
- [X] T026 Execute `specs/000-p0-scaffold/quickstart.md` gate walkthrough (7 steps) vs local `bus_api` and record PASS/FAIL per gate in `PROGRESS.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3–6)**: All depend on Foundational completion
  - US1 (Phase 3) needs T008 forwarder + T009 stores + T010 guard + T011 layout
  - US2 (Phase 4) needs T008 forwarder (hardens it); runnable right after US1
  - US3 (Phase 5) needs T011 layout; independent of US1/US2 logic
  - US4 (Phase 6) needs T003 pdfkit deps only; independent of US1–US3
  - Stories can proceed in parallel once Foundation is done (different files), or sequentially P1 → P2
- **Polish (Phase 7)**: Depends on all story phases being complete

### Within Each User Story

- Shared schemas/stores (Foundational) before story UI
- Forwarder (T008) before login wiring (T014) and health (T015)
- Story complete before moving to next priority (except US4, which is file-independent)

### Parallel Opportunities

- Phase 1: T002, T003, T004 in parallel (different files)
- Phase 2: T006, T007, T009, T010 in parallel; T008 and T011 can also start in parallel (different files)
- Phase 4: T017 in parallel with T016
- Phase 5: T018, T019 in parallel (different files)
- Phase 6: T021–T023 are sequential (generator → route → inspection)

---

## Parallel Example: Foundational Phase

```bash
# Launch independent foundation tasks together (different files, no dependencies):
Task: "Implement Egyptian-Arabic error map in lib/errors.ts (T006)"
Task: "Create shared login zod schema in lib/schemas/auth.ts (T007)"
Task: "Create zustand stores in stores/session.ts and stores/filters.ts (T009)"
Task: "Implement optimistic auth guard in proxy.ts (T010)"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 login/logout
4. Complete Phase 4: US2 proxy/health hardening
5. **STOP and VALIDATE**: login/logout + health + refresh gates vs local `bus_api` (SC-001, SC-002)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → test independently → gate SC-001
3. Add US2 → test independently → gate SC-002
4. Add US3 → visual pass → shell foundation for P1 screens
5. Add US4 → visual inspection → gate SC-003 (PASS, or conditional PASS + P3 entry gate)
6. Polish → SC-004 + quickstart walkthrough → P0 done, P1 unblocked

### Parallel Team Strategy

With multiple developers (after Foundational):

1. Developer A: US1 login (T012–T014)
2. Developer B: US2 health/hardening (T015–T017)
3. Developer C: US3 shell (T018–T020) + US4 spike (T021–T023, needs only pdfkit deps)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story independently completable and testable via its spec.md Independent Test
- No automated test tasks: spec mandates manual walkthrough + `tsc --noEmit` + eslint (runner decision deferred to P4)
- Commit after each task or logical group; never edit `bus_api` (FR-010)
- Stop at any checkpoint to validate the story independently
