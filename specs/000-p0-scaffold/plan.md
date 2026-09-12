# Implementation Plan: P0 Scaffold

**Branch**: `000-p0-scaffold` | **Date**: 2026-09-11 | **Spec**: `specs/000-p0-scaffold/spec.md`

**Input**: Feature specification from `specs/000-p0-scaffold/spec.md` (derived from `PRD.md` §§1–5, 7, 9–11).
Backend contract: `D:/Eslam/waleed/bus/bus_api/docs/openapi.json`. Backend MUST NOT be modified.

**Note**: Manual mirror of the `/speckit-plan` workflow — `setup-plan.sh` could not run
as-is (no git repo, no `.specify/scripts/` in `bus_dashboard`; script resolves feature
paths from git/`feature.json`). Paths below are the emulated outputs:
`FEATURE_SPEC=specs/000-p0-scaffold/spec.md`, `IMPL_PLAN=specs/000-p0-scaffold/plan.md`,
`SPECS_DIR=specs/000-p0-scaffold`, `BRANCH=000-p0-scaffold`.

## Summary

Scaffold the Next.js App Router RTL dashboard with arrw tokens, super_admin-only
login over an httpOnly-cookie BFF proxy (`POST /auth/login|refresh|logout`, `GET /auth/me`,
`GET /health`), optimistic `proxy.ts` guard + authoritative `(shell)/layout.tsx` check,
zustand session/filter stores, and a blocking pdfkit+Cairo+`bidi-shaper` Arabic-shaping
spike (`GET /api/reports/spike`) with a recorded PASS/FAIL + HTML-fallback decision.

## Technical Context

**Language/Version**: TypeScript `strict`, Node 24, Next.js@latest (App Router, RSC-first)

**Primary Dependencies**: shadcn (`new-york`, `lucide-react`) + Tailwind; react-hook-form +
zod@latest + `@hookform/resolvers/zod`; zustand@latest; pdfkit + `bidi-shaper` (spike);
`next/font/google` (Cairo + Poppins). apexcharts explicitly DEFERRED to P2.

**Storage**: N/A (no new DB tables; session is httpOnly cookies; filters in zustand +
cookie + URL search params)

**Testing**: Manual walkthrough vs local `bus_api` per spec US1–US4 + `tsc --noEmit` +
eslint (no test runner wired in dashboard yet — P4 decision)

**Target Platform**: Modern browsers, Arabic RTL, desktop-first responsive

**Project Type**: Web application (Next.js frontend + BFF proxy → NestJS backend)

**Performance Goals**: RSC + `loading.tsx` skeletons; proxy GETs `no-store`; lists
default `limit=20`; spike PDF < 1s generation locally

**Constraints**: Browser → backend ONLY via `/api/*`; JWTs httpOnly, never in bundle;
cursor pagination `{items, nextCursor}` mirrored exactly; `{statusCode, data}`
unwrapped once; PRD §9 Egyptian-Arabic error map; `Origin` check on mutations;
`<html lang="ar" dir="rtl">`; Western digits in tables

**Scale/Scope**: P0 only — login, shell skeleton, health proxy, spike PDF. P1–P4 out of scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] I. Super-Admin-Only — `proxy.ts` optimistic + `layout.tsx` authoritative
  `app_role === 'super_admin'` checks; generic `AUTHENTICATION_FAILED` copy. PASS.
- [x] II. Proxy-Only httpOnly — BFF forwarder, `cookies()` get/set/delete,
  refresh-retry-once, no tokens in bundle. PASS.
- [x] III. Contract Fidelity — envelope unwrapped once, cursor paging preserved,
  404/409 Arabic messages, zero backend edits. PASS.
- [x] IV. Arabic RTL + arrw — Cairo/Poppins, tokens, `lang/dir`, aria labels. PASS.
- [x] V. Server-First + Trust Boundary — RSC reads, shared zod schemas re-validated
  in route handlers, `details.fields` mapped. PASS.
- [x] VI. Auditable Governance — out of P0 scope except toast-ready error map;
  no governance UI in P0 (deferred to P2, no violation). PASS (deferred, tracked).
- [x] VII. Phase-Gated Simplicity — P0 scope only, no P1–P4 creep, spike before
  templates. PASS.

Post-design re-check (2026-09-11): no new violations; VI remains deferred by design.

## Project Structure

### Documentation (this feature)

```text
specs/000-p0-scaffold/
├── spec.md               # P0 feature spec (this plan's input)
├── research.md           # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   ├── proxy.openapi.yaml        # BFF surface (proxied backend ops + dashboard-only routes)
│   └── error-map.ar-EG.json      # PRD §9 code → Egyptian-Arabic copy
└── tasks.md              # Phase 2 output (NOT created by plan)
```

### Source Code (repository root)

```text
bus_dashboard/
├── app/
│   ├── layout.tsx                  # fonts (Cairo+Poppins), dir=rtl, theme
│   ├── loading.tsx                 # global skeleton
│   ├── (auth)/login/page.tsx       # super_admin login (US1)
│   ├── (shell)/layout.tsx          # authoritative guard (US1)
│   ├── (shell)/page.tsx            # overview skeleton (US3)
│   └── api/
│       ├── [...proxy]/route.ts     # generic forwarder (US2)
│       └── reports/spike/route.ts  # pdfkit proof (US4)
├── lib/
│   ├── api.ts / auth.ts / errors.ts
│   ├── schemas/auth.ts             # shared login zod schema
│   └── pdf/spike.ts                # pdfkit + bidi-shaper proof
├── components/ui/*                 # shadcn (new-york)
├── stores/session.ts / filters.ts  # zustand
├── proxy.ts                        # optimistic guard (US1)
└── .env.example                    # BUS_API_URL, SESSION_COOKIE_SECRET, PDF_FONT_PATH, NEXT_PUBLIC_APP_NAME
```

**Structure Decision**: Single Next.js project (plan-template Option 1 adapted for
App Router; Options 2–3 deleted as inapplicable — backend lives in sibling `bus_api`
and MUST NOT be touched).

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

No violations. Single-flight refresh and `bidi-shaper` adapter are the most complex
pieces and both are justified inline (stampede avoidance; BiDi correctness) with
simpler alternatives documented in `research.md` (naive fetch-per-request; string
reversal — both rejected with reasons).
