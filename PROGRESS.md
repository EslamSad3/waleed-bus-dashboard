# PROGRESS — Bus Platform Super-Admin Dashboard

Constitution: v1.0.1 (amended 2026-09-11: proxy.ts rename, email login, {id,email,appRole}) at `.specify/memory/constitution.md`.
PRD: `PRD.md` (single source of truth). Backend: `../bus_api` (do not modify).

## Current status

- [x] P-constitution: initial ratification (7 principles + constraints + workflow + governance)
- [x] P0 specify: `specs/000-p0-scaffold/spec.md` (US1–US4, FR-001–FR-010, SC-001–SC-004)
- [x] P0 plan: `specs/000-p0-scaffold/plan.md` + `research.md` + `data-model.md` + `contracts/` + `quickstart.md`
- [x] P0 clarify: 4 questions answered, integrated into `spec.md` (spike-FAIL gate, proxy breadth, rememberMe, visual PASS)
- [x] P0 tasks: `specs/000-p0-scaffold/tasks.md` (26/26 done: Setup 5, Foundational 6, US1 3, US2 3, US3 3, US4 3, Polish 3)
- [x] P0 implement: DONE — scaffolded + verified live vs `bus_api` on :3000 (gates below)
- [x] P1 specify: `specs/001-platform-crud/spec.md` (US1–US5, FR-001–FR-027, SC-001–SC-005; Q1 platform-first + Q2 drivers-roster clarified 2026-09-11; requirements checklist green)
- [x] P1 plan: `specs/001-platform-crud/plan.md` + `research.md` (R1–R7, zero open clarifications) + `data-model.md` + `contracts/` (p1-resources map + error-map additions) + `quickstart.md`
- [ ] P1 tasks: next — dependency-ordered task list, then implement
- [x] P1 tasks: `specs/001-platform-crud/tasks.md` (32 tasks: Setup 2, Foundational 8, US1–US5 ×4, Polish 2; format-validated, no test tasks per spec)
- [x] P1 implement: DONE — 14 routes + 5 action modules + registry + scope selector, verified live (gates below)
- [ ] P2 governance

## P1 gate evidence (verified 2026-09-11, dashboard :3101 → api :3000)

- Fleet create → bus create → trip create → reverse-delete chain all 200; deleted fleet → 404 "العنصر مش موجود في الأسطول ده".- Registry validation live: bad bus body → 400 `VALIDATION_FAILED` + `details.fields` (Arabic, per-field).
- Bare-409 `CONFLICT` confirmed for duplicate registration AND referenced-fleet delete (proxy-level generic; UI substitutes per-screen context via `conflictMessage`).
- Cross-fleet trip create → 404 Arabic; bus disable/reactivate round-trip 200 via tenant path + `x-fleet-id`.
- `DRIVER_ASSIGNMENT_NOT_ALLOWED` → correct Arabic message live (roster invite rejected backend-side; mapping verified).
- 9/9 P1 pages HTTP 200 with Arabic markers; no `BUS_API_URL` in client bundle; `tsc` + eslint + `next build` clean (build caught one `next/headers`-in-client-bundle error, fixed by splitting `lib/fleet-scope-cookie.ts`).
- P1 deviations from plan (documented): list/detail pages are client components fetching `/api/*` (P0 login precedent) instead of RSC — guard + proxy stay server, no tokens in JS; toasts realized as inline `role=status` messages (no toast lib); `destructive` button variant added to the P0 primitive.
- Error-map fixes shipped: `BUS_ACCESS_DENIED`, `BAD_REQUEST`, `RATE_LIMITED`, `FORBIDDEN`, `CONFLICT` keys (P0 `RATE_LIMITED_429` dead key kept for compat).

## P1 follow-up fixes (operator screenshots, 2026-09-11, verified live on :3102)

- Empty optional fields (`ownerRoleSlug`, plate, passenger phone) mapped `""`→`undefined` in forms — the raw English "Too small…" zod error is gone; boundary still rejects `""` with Arabic field messages ("دور المالك الابتدائي غير صحيح", "اختار الدور").
- `FleetPicker` dropdown added to `/buses/new`, `/trips/new`, `/bookings/new` (defaults to scope, syncs back, resets dependent pickers on fleet change).
- Bus-detail driver assign is now a dropdown of the fleet's ACTIVE drivers (value = `userId`); empty guard message is "اختار السواق الأول".
- Shared cookie write extracted to `setFleetScopeCookie` (`lib/fleet-scope-cookie.ts`); `tsc` + eslint + `next build` clean.

## Super Admin Booking Review & Payment Reconciliation (verified 2026-09-14)

- **Backend Integration**: Platform path `/api/admin/bookings` and `/api/admin/bookings/:id` implemented and integrated per spec `005-super-admin-booking-review`.
- **Global Booking List**: Implemented `/bookings` with global visibility across all fleets, multi-criteria filtering (fleet, status, payment status, payment method, date range, passenger name/phone, driver incident reports), and cursor pagination.
- **Relational Inspection**: Implemented `/bookings/[id]` presenting full booking graph (passenger profile with verification status, trip & vehicle capacity, driver info, ratings, driver passenger reports, inline audit trail).
- **Payment Reconciliation**: Offline wallet payment verification with exact-match validation (`POST /admin/bookings/:id/payment/verify`), mark as failed (`POST /admin/bookings/:id/payment/fail`), and full/partial refund tracking (`POST /admin/bookings/:id/payment/refund`).
- **Administrative Lifecycle Overrides**: Force cancellation with seat release controls (`POST /admin/bookings/:id/cancel`), reinstatement with capacity validation (`POST /admin/bookings/:id/reinstate`), and driver operational status overrides (`PATCH /admin/bookings/:id/operational`).
- **Incident Report Resolution**: Closed-loop resolution lifecycle for driver passenger reports (`PATCH /admin/bookings/:id/reports/:reportId`).
- **Quality Gates**: `tsc --noEmit`, ESLint on modified/new modules, and `next build` all PASS cleanly.

## Blockers (filed as bus_api change requests — backend untouched)

- ~~**Bookings 500**~~: Resolved for Super Admin management via the global platform review flow (`/admin/bookings`). Tenant-scoped `/fleets/:fleetId/bookings` remains for tenant actors.
- Roster invite (`POST /fleet/drivers`, fresh or existing user) → 409 `DRIVER_ASSIGNMENT_NOT_ALLOWED` even with explicit `driver` role — backend semantics unclear (driver-capable role resolution?); dashboard mapping correct. Needs backend clarification, not a dashboard bug.
- [ ] P1 platform CRUD
- [ ] P2 governance
- [ ] P3 reports + PDFs
- [ ] P4 hardening

## Gates

| Phase | Gate | Status |
|---|---|---|
| P0 | login/logout as super_admin vs local API; `/api/health` proxies; spike PDF shapes Arabic | PASS (2026-09-11; details below) |
| P1 | CRUD walkthrough per module, 409/404 Arabic messages | CONDITIONAL PASS (2026-09-11; bookings blocked backend-side, see below) |
| P2 | permission change in matrix; audit row per mutation; charts + empty states | PENDING |
| P3 | 3 PDFs download with correct shaping + real data | PENDING |
| P4 | `tsc + eslint` clean, click-through, docs committed | PENDING |

## P0 gate evidence (verified 2026-09-11, dashboard :3100 → api :3000)

- Login 201 + httpOnly `sa_access` (Max-Age 900) / `sa_refresh` (session); identity `appRole: super_admin`.
- Wrong creds → 401 `بيانات الدخول غير صحيحة`; bad shape → 400 + `details.fields` (email/password Arabic).
- Logout clears both cookies; post-logout `/me` → 401 generic.
- `/api/health` → `{status:'ok'}`; no `BUS_API_URL` in client bundle (`.next/static` scan).
- Anon `(shell)` → 307 `/login`; shell renders `lang=ar dir=rtl` + headline + KPI cards + navy band.
- Spike PDF: `%PDF`, Cairo embedded, ToUnicode, deterministic 6042 B; `bidi-shaper` output verified (presentation forms + LTR digits). Human open-PDF check left to operator.
- `tsc --noEmit` + eslint clean; `next build` clean (no middleware/Turbopack warnings after `proxy.ts` migration).

## Implementation amendments (contract fidelity wins)

- Login is **email + password** (backend platform login resolves by email; no `loginType`) — PRD §5.2 phone rule superseded.
- Session is `{id, email, appRole}` from `CurrentUserDto` (no `name`); guard on `appRole`.
- rememberMe: unchecked → session cookie; checked → 7-day persistent (backend window).
- `middleware.ts` → `proxy.ts` (Next.js 16 deprecation; behavior identical).

## Open / deferred

- Human visual open-PDF confirmation (operator opens `/api/reports/spike` output).
- Non-super_admin live rejection test (needs a second seed; do in P2).
- `pnpm` script runner hits `ERR_PNPM_IGNORED_BUILDS` (unrs-resolver) in this env — used `./node_modules/.bin/*` directly; consider `pnpm approve-builds` on the operator machine.
- `.env.local` created locally (gitignored); `.env.example` is the contract.

## Blockers

- ~~pdfkit Arabic shaping~~ — proven mechanically (shaping + order + embedding); visual confirm pending.
- `docs/openapi.json` drift — re-check proxy paths whenever `bus_api` regenerates docs.

## P0 scope (own words)

Scaffold the Next.js (App Router, RTL, Cairo/Poppins, arrw tokens) app with shadcn,
super_admin-only login (email + password — backend resolves platform login by email),
httpOnly-cookie session, generic `/api/[...proxy]` forwarder with refresh +
Egyptian-Arabic error map, zustand session/filter stores, proxy + layout
double-guard, and a blocking pdfkit spike proving correct Arabic glyph shaping.
No backend changes.
No speckit skills installed — spec → plan → tasks → implement will be mirrored manually.
