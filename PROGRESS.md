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

## AG Grid Community tables (2026-09-19)

- Shared Community grid added for shell collection views with Arabic search,
	column filters, client pagination, CSV export, cursor load-more, and responsive
	RTL styling.
- Primary and detail collection views migrated; native table/card collection
	renderers were removed from the in-scope routes.
- `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass. ESLint retains one
	pre-existing React Hook Form compiler warning in `app/(shell)/trips/new/page.tsx`.
- Manual browser walkthrough remains to be completed against the operator's live
	authenticated session.

## P1 gate evidence (verified 2026-09-11, dashboard :3101 → api :3000)

- Fleet create → bus create → trip create → reverse-delete chain all 200; deleted fleet → 404 "العنصر مش موجود في الأسطول ده".- Registry validation live: bad bus body → 400 `VALIDATION_FAILED` + `details.fields` (Arabic, per-field).
- Bare-409 `CONFLICT` confirmed for duplicate registration AND referenced-fleet delete (proxy-level generic; UI substitutes per-screen context via `conflictMessage`).
- Cross-fleet trip create → 404 Arabic; bus disable/reactivate round-trip 200 via tenant path + `x-fleet-id`.
- `DRIVER_ASSIGNMENT_NOT_ALLOWED` → correct Arabic message live (roster invite rejected backend-side; mapping verified).
- 9/9 P1 pages HTTP 200 with Arabic markers; no `BUS_API_URL` in client bundle; `tsc` + eslint + `next build` clean (build caught one `next/headers`-in-client-bundle error, fixed by splitting `lib/fleet-scope-cookie.ts`).
- P1 deviations from plan (documented): list/detail pages are client components fetching `/api/*` (P0 login precedent) instead of RSC — guard + proxy stay server, no tokens in JS; toasts realized as inline `role=status` messages (no toast lib); `destructive` button variant added to the P0 primitive.
- 2026-09-27 — toasts now real per PRD §10: `sonner` installed, `<Toaster />` (RTL, bottom-left, adapted to the custom tokens in `components/ui/sonner.tsx`) mounted app-wide in `app/providers.tsx`. Every mutation in `lib/actions/*.ts` (66 wrappers) fires Egyptian-Arabic success/error toasts via `notifyResult` (`lib/actions/toast.ts`); per-field validation failures stay silent (inline field errors). Composed flows (driver invite + picture, fleet-owner create/edit + picture) keep one toast via `{ notify: false }` on the upload step. Existing inline `role=status` notes/banners kept alongside. Login unchanged (inline errors; navigates on success). Sign-out failure now toasts.
- 2026-09-28 — **spec 014: fleets and fleet-owners merged into one screen** (dashboard half of the API's `/fleet-owners` unification). `/fleets` and `/fleets/[id]` are deleted; `next.config.ts` 308-redirects `/fleets` → `/fleet-owners` and `/fleets/:id` → `/fleet-owners?fleet=:id`. `/fleet-owners` now shows each owner's companies inline (count + names) and `/fleet-owners/[id]` has *Account* / *Companies* tabs, with one company expanded at a time (summary + Buses/Members/Trips/Bookings/Reports) so opening a company is what sets the `x-fleet-id` scope the `/fleet/*` calls need. `FleetSummaryCard` and `FleetSections` were extracted from the deleted route verbatim; `AddFleetToOwnerDialog` is now shared. The `GET /fleet-owners/fleets` response embeds the owner, which removed the `GET /users?limit=100` fan-out the old fleet list needed. BFF paths, the zod registry in `lib/schemas/p1.ts` (keyed on the backend path), the `fleet-owner` role slug (now `fleet_owner`) and the i18n sections (`fleets.*` folded into `fleetOwners.fleets.*`) all moved with it. Dead code removed: `components/fleet-scope-select.tsx`, `lib/fleet-scope.ts`, their `fleetScope.*` keys. Gates: `lint` (0 errors, 4 pre-existing RHF warnings), `typecheck`, `i18n:check` (1407 keys, 0 orphans), `build`.
- 2026-09-27 — all 12 `window.confirm` guards replaced with a reusable RTL confirm modal: `ConfirmDialogProvider` + `useConfirm()` (`components/ui/confirm-dialog.tsx`, promise-based `if (!(await confirm({...}))) return;`, renders through the shared `Dialog` primitive, destructive red confirm, copy per `copy-ar-EG.md` — "تأكيد المسح / مسح / إلغاء" and the roster revoke warning). Provider mounted in `app/providers.tsx`. Call sites: buses/[id] (delete, unassign), drivers/[id] (status change, remove), fleets/[id] (delete), stops, trip-lines/[id], trips/[id] (cancel, delete), users, members-tab (status change, remove).
- 2026-09-27 — loading state on every async button (duplicate-request guard). `Button` gained a `loading` prop (spinner + forced `disabled` + `aria-busy`; ignored with `asChild`); new `components/ui/async-button.tsx` wraps it for click-triggered actions — an async `onClick` auto-manages pending via a ref-based in-flight guard, so double clicks can never fire twice; `RowActionsMenu` now accepts promise-returning `onSelect` (all items disable + spinner while in flight). Every unguarded async call site converted to `AsyncButton` (drivers/[id], buses/[id] ×8, fleets/[id], trips/[id] ×6, trip-lines/[id], stops, brands, markaz, localities, vip-tiers, promotions, users openEdit, notifications refresh/search, image-picker trigger during upload) and every previously state-guarded submit normalized to the same visual (`loading={saving|isSubmitting|busy}`) across the create/action dialogs, booking-action-dialogs ×7, login, inline shell-page dialogs, sign-out, and the ag-grid load-more. Redundant local `saving`/`assigning` states removed where AsyncButton made them unused. `pnpm lint` (0 errors; pre-existing RHF compiler warnings remain), `pnpm typecheck`, and `pnpm build` pass.
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

## Responsiveness + skeleton loading overhaul (2026-09-27)

- Skeleton primitives added (`components/ui/skeleton.tsx` + `components/ui/skeletons.tsx`: Table/CardsGrid/KpiCards/DetailPage/Form/InlineBlock); per-page skeleton loading on every TanStack Query first-load across all 29 dashboard pages (login is the documented no-async-data exception); full responsive pass 360px→1440px over pages, shell (off-canvas drawer) and `components/ui` (dialogs scroll internally); `.page-heading` wraps globally; `pnpm lint` (0 errors), `pnpm typecheck`, and `pnpm build` pass.

## Notification push summary (2026-09-29)

- `POST /platform/notifications` now returns a `push` object alongside the existing `sentCount` / `isGlobal` / `notificationIds`: `{ status, acceptedDeviceCount, failedDeviceCount, skippedUserCount }` (backend `bus_api`, spec 012 FCM integration).
- `SendNotificationResult` extended with `PushSummary`; `lib/i18n/push-summary.ts` composes the operator copy from the dictionary. Inbox rows saved and Firebase device acceptance are reported as **separate** lines on purpose — the two numbers mean different things and merging them would claim a delivery guarantee FCM does not make. `status: "disabled"` (push off server-side) and `status: "incomplete"` (dispatch stopped early, counts partial) are stated explicitly; `failed` / `skipped` lines only appear when non-zero.
- The send dialog now renders one composed result banner carrying all of it, and `sendPlatformNotification` passes `notify: false` so the old generic action-wrapper toast (copy `notifications.toast.sentGlobal` / `sentDirect`, no counts) is gone — one success surface, no duplicate. Those two dictionary keys were removed; `pnpm i18n:check` reports 0 unreferenced keys.
- Mobile-side onboarding (installation id, `bus_notifications` channel, token rotation, account switching, foreground rendering) is documented in `../bus_api/docs/ANDROID_FCM_INTEGRATION.md`. `pnpm i18n:check`, `pnpm typecheck`, `pnpm lint` pass (0 errors; pre-existing RHF compiler warnings remain).

## Owner tenants replace fleets (2026-09-29)

Backend spec 014-final: the **owner user is the company**, so there is no company
level under a fleet owner any more, and a trip line is **one direction**.

- Tenant scope renamed end to end: `fleetId` → `ownerId`, `x-fleet-id` → `x-owner-id`, `stores/filters.ts` and `lib/owner-scope-cookie.ts` follow. `lib/actions/fleets.ts`, `components/fleets/`, `components/fleet-picker.tsx`, and `lib/fleet-scope-cookie.ts` are deleted; `next.config.ts` sends both old `/fleets` bookmarks to `/fleet-owners`.
- Every owner-scoped route is `/fleet-owners/{ownerId}/…`, and **trips are nested under their line** (`/trip-lines/{lineId}/trips`): a trip takes its bus *and* its line and derives `origin`/`destination` from the line's first/last ordered stop, so no form ever sends a From/To or a direction. `lib/actions/trips.ts` gained `findTripAcrossLines` for deep links.
- Screens: `/fleet-owners` is a flat owner index with a `companyName` column (the old "N companies" column and the add-company dialog are gone); `/fleet-owners/[id]` carries the account form plus seven owner sections (buses, members + add-member form, drivers, trip lines, trips, bookings, reports) reading `/fleet-owners/{ownerId}/…` directly. `/buses`, `/trip-lines`, `/trips` and the booking create dialog each open with an `OwnerPicker`; `/trip-lines` is the super-admin cross-owner index (read-only) and `/buses` is the cross-owner bus index.
- New driver views: `/drivers/[id]` (cross-owner KPIs, snapshotted-driver trips with per-trip rating averages) and the three histories `/drivers/[id]/assignments|ratings|trips`; a trip's feedback is `/trips/{id}/feedback` (passenger, line, bus, snapshotted driver, and the **bus and driver rating sides side by side**). A missing rating is an explicit "not rated yet" state, never a zero (`components/owners/rating-cell.tsx`).
- A bus no longer owns a line: the bus detail dropped the line-assignment controls and its trips tab is a real cursor-paginated history. `avgRating` (mean bus rating across the bus's trips) now comes from the API on every bus list row, so `/buses` shows the average without a per-bus fan-out.
- Promotions: the audience editor (global vs named targets) and `maxTotalUses` (blank = unlimited, now stated in the hint) are validated at the trust boundary — `createPromotionSchema` / `updatePromotionSchema` are registered in `lib/schemas/p1.ts` for `/platform/promotions`, which previously passed through unvalidated — and the window is checked for `startsAt < expiresAt`.
- i18n: 66 fleet-era keys removed, copy reworded to company wording, `common.notFound.inFleet` → `inOwner`. Gates: `i18n:check` (1351 keys, 0 unreferenced), `typecheck`, `lint` (0 errors; 2 pre-existing RHF compiler warnings), `build`.

## Breadcrumbs + bus–driver assignment flows (2026-10-03)

- Shared `Breadcrumbs` mounted in `(shell)/layout.tsx` above page content (route-only, so it stays visible during loading/empty/error). Registry `lib/breadcrumbs.ts` covers all 30 authenticated pages (19 root/index + 11 nested); every trail starts at the overview, ancestors are links preserving `owner`/`ownerId`/`lineId`, current page carries `aria-current="page"`, detail labels are localized (no raw ids). Login stays outside the shell; legacy `/fleets` redirects render the destination trail.
- `pnpm routes:check` (`scripts/check-routes.mjs`) compares shell page files against the registry and fails on any gap (verified: probe page fails, removal passes).
- Bus-row "تعيين سواق" (`AssignDriverDialog`, bus fixed, ACTIVE drivers of the bus's owner scope) shared by `/buses`, owner bus tables, and bus detail (whose inline assign dialog was removed). Driver-row "تعيين عربية" (`AssignBusDialog`, driver fixed, active buses of the driver's scope) plus "إضافة عربية" (`AddBusDialog`: existing default / create-new delegating to the creation flow with the driver fixed).
- `CreateBusDialog` gained ownership modes (fleet-owner default with the existing picker; independent-driver deriving the personal scope from the roster row and assigning immediately) and a fixed-driver mode (driver Add-bus → create): one composed create-then-assign with a single outcome message, staged-image cleanup on creation failure, retained bus + partial message + assignment-only retry on assignment failure. Same payload and `{ driverUserId }` POST to `/fleet-owners/{ownerId}/buses/{busId}/driver`; mode stays form state. Pickers page the full cursor, search loaded choices, retain selection, and block close/double-submit while saving.
- Freshness: bus inserts patch the cache, assignment-family keys are evicted, owner tables reload via `onCreated`/`onAssigned`; independent-owned buses fall back to a readable owner label instead of a raw id.
- Gates: `lint` (0 errors; 2 pre-existing warnings), `typecheck`, `i18n:check` (1518 keys, only pre-existing + dynamic-registry unused warnings), `build` (all 30 routes + login), `routes:check` (30/30). Trail unit harness: 30/30 label + ancestor-link + context-preservation assertions pass. Browser smoke (dev :3105): `/login` renders with no breadcrumb nav, `/` redirects to `/login` (shell guard intact).
- Remaining browser limitations (no live backend session in this env): authenticated click-through of all 30 breadcrumb trails, both assignment directions, both Add-bus branches, beyond-first-cursor choices, empty/stale/repeat/cross-owner eligibility, image-failure cleanup, partial-success retry, and mobile RTL wrapping still need an operator walkthrough against `bus_api` with a signed-in super_admin.

## Mutation freshness and response audit (2026-09-30)

- The global `/drivers` roster has no page-level owner selector. Creation offers independent and owner-associated modes; only the latter asks for an owner. The API creates the user and membership together and retains a revoked independent membership for audit/reactivation.
- Every successful dashboard `apiSend`/file mutation announces a record change to the single app-wide QueryClient. Active views refetch and inactive views become stale for navigation back. Known records receive an immediate shape-safe cache merge; filtered lists and dependent views refetch from the server. Failures never update the cache.
- `CursorList` now detects edits when the row ID is unchanged and includes genuinely new first-page rows. The cache helper no longer mistakes detail objects for cursor pages or writes ID-only placeholders over complete rows.
- The proxy keeps stable error codes, Arabic messages and field details. Action wrappers show Arabic success/error toasts for mutations. Database schema drift has a dedicated Arabic error.
- API migrations `20260930180000_remove_both_stop_type` and `20260930200000_trip_stop_snapshots` were deployed to the configured database; RLS setup/check and Prisma migration status passed. API gate: typecheck, lint, build, OpenAPI generation, and coverage (81 files, 817 tests; lines 88.05%, functions 85.51%, statements 87.12%, branches 74.47%). Dashboard gate: typecheck, lint (0 errors, 2 existing warnings), i18n check, build. Browser click-through with a signed-in account remains unverified.
