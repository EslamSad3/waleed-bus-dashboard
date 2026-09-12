# Implementation Plan: P1 Platform CRUD

**Branch**: `001-platform-crud` | **Date**: 2026-09-11 | **Spec**: `specs/001-platform-crud/spec.md`

**Input**: Feature specification from `specs/001-platform-crud/spec.md` (derived from `PRD.md` §§1–2, 5–6, 8–12).
Backend contract: `D:/Eslam/waleed/bus/bus_api/docs/openapi.json` (57 paths). Backend MUST NOT be modified.

**Note**: Manual mirror of the `/speckit-plan` workflow — no git repo, no `.specify/scripts/`
(`setup-plan.sh` / `update-agent-context.sh` absent). Emulated paths:
`FEATURE_SPEC=specs/001-platform-crud/spec.md`, `IMPL_PLAN=specs/001-platform-crud/plan.md`,
`SPECS_DIR=specs/001-platform-crud`, `BRANCH=001-platform-crud`. Agent-context update
N/A: no agent script present and P1 adds zero new dependencies (all P0 deps reused).

## Summary

Build fleet-scoped CRUD for fleets, buses (+ lifecycle actions + per-bus trips tab),
trips, bookings, fleet members, and the drivers roster on top of the P0 BFF proxy:
platform `/fleets/*` for all list/detail/create/edit/delete, tenant `/fleet/*` +
`x-fleet-id` only for bus disable/reactivate, driver assign/unassign, per-bus trips,
and the driver roster. A zod schema registry (`lib/schemas/p1.ts`) extends the
generic `[...proxy]` forwarder (no new auth/refresh/envelope paths); the error map
gains code keys plus per-screen bare-409 `CONFLICT` context messages; list
search/filters apply over loaded cursor pages (backend exposes cursor+limit only).

## Technical Context

**Language/Version**: TypeScript `strict`, Node 24, Next.js 16.3.4 (App Router, RSC-first) — P0 pinned, unchanged

**Primary Dependencies**: P0 set reused (shadcn new-york, RHF + zod + resolvers, zustand, Cairo/Poppins); apexcharts still DEFERRED to P2; pdfkit untouched. Zero new deps.

**Storage**: N/A (no new DB tables; fleet scope in zustand + cookie; URL search params for list filters)

**Testing**: Manual gate walkthrough vs local `bus_api` per spec US1–US5 + `tsc --noEmit` + eslint (same as P0; no test runner yet — P4 decision)

**Target Platform**: Modern browsers, Arabic RTL, desktop-first responsive (unchanged)

**Project Type**: Web application (Next.js frontend + BFF proxy → NestJS backend; backend in sibling `bus_api`, untouched)

**Performance Goals**: RSC + per-route `loading.tsx` skeletons; lists default `limit=20`; proxy GETs `no-store`; pickers reuse cached reads where trivially safe

**Constraints**: Browser → backend ONLY via `/api/*`; platform-vs-tenant path rule (research R1); cursor `{items, nextCursor}` mirrored exactly, opaque; bare-409 `CONFLICT` mapped per-screen (never message-sniffing); PRD §9 + additions Egyptian-Arabic map; `Origin` check on mutations; Western digits in tables

**Scale/Scope**: P1 only — 5 modules + roster. Users/roles/audit/charts (P2), report PDFs (P3), dark mode/README (P4) out of scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] I. Super-Admin-Only — all P1 screens under existing `(shell)` guard; no new auth surface; roster warnings respect lockout rules. PASS.
- [x] II. Proxy-Only httpOnly — registry plugs into the P0 forwarder; `x-fleet-id` via server-side cookie → `busFetch`; no tokens in bundle. PASS.
- [x] III. Contract Fidelity — platform/tenant paths per contract; cursor+envelope mirrored; client-side filtering declared (not silently assumed); 404-never-403; zero backend edits. PASS.
- [x] IV. Arabic RTL + arrw — P0 shell/tokens/fonts reused; new strings go to `copy-ar-EG.md`; Western digits in tables. PASS.
- [x] V. Server-First + Trust Boundary — RSC list/detail reads, Server Actions → `/api/*`, shared zod schemas re-validated in proxy registry, `details.fields` mapped. PASS.
- [x] VI. Auditable Governance — every mutation toast names the action; suspend/revoke/remove carry pre-action warnings (authVersion bumps); audit VIEWER itself stays P2 (deferred, tracked). PASS (deferred part noted).
- [x] VII. Phase-Gated Simplicity — P1 scope only (members + roster clarified, nothing more); registry over per-resource handlers; no P2–P4 creep. PASS.

Post-design re-check (2026-09-11): no new violations; VI viewer + apexcharts remain deferred by design (P2).

## Project Structure

### Documentation (this feature)

```text
specs/001-platform-crud/
├── spec.md                     # P1 feature spec (this plan's input)
├── research.md                 # Phase 0 output (R1–R7, all resolved)
├── data-model.md               # Phase 1 output (Fleet/Bus/Trip/Booking/Member/Roster/Scope)
├── quickstart.md               # Phase 1 output (P1 gate walkthrough)
├── contracts/                  # Phase 1 output
│   ├── p1-resources.openapi.yaml      # dashboard op → backend op + schema + Arabic copy
│   └── error-map-additions.ar-EG.json # new code keys + CONTEXT_409_* per-screen messages
├── checklists/requirements.md  # spec quality gate (green)
└── tasks.md                    # Phase 2 output (NOT created by plan)
```

### Source Code (repository root)

```text
bus_dashboard/
├── app/(shell)/
│   ├── fleets/page.tsx  new/page.tsx  [id]/page.tsx      # US1 (tabs link to scoped modules)
│   ├── buses/page.tsx   new/page.tsx  [id]/page.tsx      # US2 (+ trips tab, actions)
│   ├── trips/page.tsx   new/page.tsx  [id]/page.tsx      # US3
│   ├── bookings/page.tsx new/page.tsx [id]/page.tsx      # US4
│   ├── drivers/page.tsx new/page.tsx  [id]/page.tsx      # US5 roster
│   └── loading.tsx (per-route skeletons)
├── components/
│   ├── fleet-scope-select.tsx  # picker → filters store + cookie (R6)
│   ├── tables/*                # cursor list + "عرض المزيد" + empty states
│   └── ui/*                    # P0 shadcn set reused
├── lib/
│   ├── schemas/p1.ts           # registry: Create/Update/Add/Assign zod schemas (R2)
│   ├── errors.ts               # extended map + per-screen CONFLICT context (R3)
│   └── api.ts                  # busFetch reused (fleetId → x-fleet-id)
├── stores/filters.ts           # extended: fleetId + per-list UI filters
└── specs/dashboard/copy-ar-EG.md # extended with P1 strings (FR-024)
```

**Structure Decision**: Single Next.js project (same as P0; plan-template Options 2–3 inapplicable — backend is the sibling `bus_api`).

## Complexity Tracking

No violations. Most complex pieces: zod registry keyed by method+path (justified: single trust boundary vs ~20 duplicated handlers) and per-screen `CONFLICT` context mapping (justified: backend emits codeless 409s; alternative message-sniffing rejected in R3).
