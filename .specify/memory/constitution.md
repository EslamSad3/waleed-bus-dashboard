<!--
Sync Impact Report
- Version change: 1.0.0 → 1.0.1 (PATCH: framework-mandated filename + field-name clarifications, no rule changes)
- v1.0.1 amendments (2026-09-11, from P0 implementation grounding vs live backend + Next.js 16):
  - Principle I: `middleware.ts` → `proxy.ts` (Next.js 16 deprecated the middleware convention; behavior identical)
  - Principle I: guard reads `appRole` from `GET /auth/me` (`CurrentUserDto`); `app_role` lives inside the JWT only
  - Session shape corrected to `{id, email, appRole}` (backend has no `name` field)
  - Platform login is email + password (no `loginType`); PRD §5.2/§6.1 phone assumption superseded (contract fidelity wins)
  - rememberMe capped at backend 7-day refresh window (was 30 days)
- Version change: (none — initial ratification) → 1.0.0
- Modified principles: none (initial ratification; derived from PRD §§2–10 and bus_api constitution v1.0.0)
- Added principles:
  I. Super-Admin-Only Access (NON-NEGOTIABLE)
  II. Proxy-Only Backend Access with httpOnly Session
  III. Backend Contract Fidelity
  IV. Arabic-First RTL UI with arrw.com Identity
  V. Server-First Rendering with Trust-Boundary Validation
  VI. Auditable, Lockout-Respecting Governance
  VII. Simplicity and Phase-Gated Delivery
- Added sections: Technology Constraints; Development Workflow; Governance
- Removed sections: none (template placeholders replaced)
- Templates requiring updates:
  ✅ .specify/templates/plan-template.md — pending copy from bus_api (Constitution Check must gate on principles I–III)
  ✅ .specify/templates/spec-template.md — pending copy from bus_api (must require Arabic copy + error-code map)
  ✅ .specify/templates/tasks-template.md — pending copy from bus_api (must enforce P0→P4 phase order)
  ⚠ .specify/templates/commands/*.md — no command files present in bus_dashboard; pending creation if speckit skills added
  ⚠ README.md / docs/quickstart.md — not yet present; must reference this constitution when created (P4)
- Follow-up TODOs:
  - TODO(TEMPLATES): copy plan/spec/tasks templates from bus_api into bus_dashboard/.specify/templates/ and tailor Constitution Check
  - TODO(P0-SPIKE): pdfkit Arabic-shaping spike (PRD §7) must prove correct shaping before P3; fallback decision recorded in P0 spec
-->

# Bus Platform Super-Admin Dashboard Constitution

## Core Principles

### I. Super-Admin-Only Access (NON-NEGOTIABLE)
Only `super_admin` may pass login and enter the `(shell)` routes. Every guarded surface
MUST verify the super_admin role twice: an optimistic cookie-presence check in
`proxy.ts` (Next.js 16 convention) plus the authoritative `appRole === 'super_admin'`
check from `GET /auth/me` in `(shell)/layout.tsx` (`app_role` lives inside the JWT
only). Any other role or anonymous user MUST be rejected with the generic
`AUTHENTICATION_FAILED` message and redirected to `/login`. Platform login is email +
password with no `loginType` (backend contract); backend lockout rules MUST be
respected, never worked around: the `system` role is immutable and the last active
`super_admin` cannot be demoted, deactivated, or deleted.

### II. Proxy-Only Backend Access with httpOnly Session
The browser MUST talk to `bus_api` only through same-origin Next.js API-route proxies
(`/api/*`). Access and refresh JWTs MUST live in httpOnly cookies (`sa_access` + `sa_refresh`,
`Secure`, `SameSite=Lax`) and MUST never appear in localStorage, sessionStorage, URL
params, or the client bundle. The proxy MUST attach the JWT server-side, unwrap the
`{statusCode, data}` envelope, map backend `code`s to the Egyptian-Arabic messages in
PRD §9, enforce `Origin` checks on mutations, use `cache: no-store` for proxied reads,
and perform single-flight `POST /auth/refresh` with retry-once semantics on 401.

### III. Backend Contract Fidelity
The dashboard MUST mirror the backend contract exactly and MUST NOT invent shapes the
backend does not return. Lists MUST use cursor pagination (`?cursor=&limit=`,
`{items, nextCursor}`, default `limit=20`, "عرض المزيد" load-more affordance, never
page counts or offset paging). Errors arrive as `{statusCode, code, message, details?}`
and MUST be surfaced via the PRD §9 Arabic map (404 means "not in this fleet", never
"no permission"; 409 guards must show, not silently hide). The backend MUST NOT be
modified; missing capabilities become separate `bus_api` change requests.

### IV. Arabic-First RTL UI with arrw.com Identity
The UI is Arabic (Egyptian dialect) only with `<html lang="ar" dir="rtl">`. Arabic text
MUST use Cairo and Latin/digits MUST use Poppins via `next/font/google`. Western digits
are used inside tables; all labels, errors, and `aria-label`s are Egyptian Arabic.
Visual tokens MUST clone PRD §3: page gradient `linear-gradient(270deg,#e8e8ec,#e9efff,
#fff)`, primary `#2f719e`, amber `#fff7e3` / blue `#daeaf5` tinted cards, navy bands,
dark mode bg `#000557`. Signature components (gradient headline, tinted KPI cards,
navy CTA band) MUST be present.

### V. Server-First Rendering with Trust-Boundary Validation
Pages MUST default to React Server Components fetching via `lib/api.ts`; charts
(apexcharts + react-apexcharts) MUST be client-only (`next/dynamic`, `ssr:false`) with
loading skeletons and empty states. Every form MUST use react-hook-form + shadcn
`ui/form` + zod schemas in `lib/schemas/` shared with the route handler. Every
mutation MUST be re-validated with zod inside the API route handler (the trust
boundary), even when the form already validated client-side, and server
`details.fields` MUST map back onto fields with Egyptian-Arabic inline errors.

### VI. Auditable, Lockout-Respecting Governance
Every mutation MUST surface its audited action in a toast and MUST leave a row in
`GET /audit-logs` viewable with actor/action/resource/date filters and a metadata
drawer. Permission-matrix changes MUST reflect immediately. Destructive or
session-revoking actions (suspend, revoke, remove, role change — all of which bump
`authVersion`) MUST show a pre-action warning. The UI MUST disable (not delete)
`system`-role edit controls with a tooltip, and MUST surface last-super_admin 409s
instead of hiding the buttons.

### VII. Simplicity and Phase-Gated Delivery
Delivery follows PRD phases in order (P0 → P4) via spec → plan → tasks → implement,
each with its acceptance gate; a phase MUST NOT start until the prior gate passes.
Prefer small explicit solutions over generic abstractions. No fleet-owner, driver, or
passenger views; no live GPS, payments, notifications, or multi-language UI in v1.
PDF scope v1 is exactly the 3 pdfkit templates (fleet summary, trip manifest /
settlement, reports digest) with embedded Cairo font and correct Arabic shaping.

## Technology Constraints

- Framework: Next.js@latest (App Router, RSC-first, single `ar` locale), TypeScript
  `strict`, pnpm only.
- UI: shadcn (`new-york`, `lucide-react`) + Tailwind; `@/*` alias; `--primary:#2f719e`,
  `--secondary:#daeaf5`, `--accent:#fff7e3`, `--foreground:#1a1a1a`,
  `--muted-foreground:#606060`, `--radius:1rem`.
- Forms/state/data: react-hook-form + zod@latest + `@hookform/resolvers/zod`;
  zustand@latest (`stores/session.ts`, `stores/filters.ts`) + URL search params;
  Server Components via `lib/api.ts`, mutations via Server Actions → API routes.
- Charts/PDFs: apexcharts + react-apexcharts (client-only); pdfkit in Route
  Handlers with embedded Cairo font; filenames `تقرير-<scope>-<date>.pdf`.
- Session/env: httpOnly cookies only; `BUS_API_URL` is server-only (never in client
  bundle); `SESSION_COOKIE_SECRET`, `PDF_FONT_PATH`, `NEXT_PUBLIC_APP_NAME`.
- Quality gates: `tsc --noEmit` + eslint clean plus manual walkthrough against local
  `bus_api` per phase; `docs/openapi.json` drift re-check on every proxy change.
- Forbidden: direct browser → `BUS_API_URL` calls, tokens in browser storage, offset
  pagination, unwrapping/renaming backend envelopes, backend modifications from this
  repo, non-Arabic UI copy.

## Development Workflow

- Spec-driven: each phase starts from a spec under `specs/<NNN-name>/` derived from
  (never rewriting) `PRD.md`, then plan → tasks → implement.
- P0-first risk order: scaffold + login + proxy + session store + pdfkit
  Arabic-shaping spike (blocking; HTML-render fallback if shaping fails).
- Verification per phase: `tsc --noEmit`, eslint, gate walkthrough against locally
  running `bus_api` (login/logout as super_admin; CRUD with 409/404 Arabic messages;
  permission change in matrix; audit row per mutation; charts with empty states;
  PDFs with real data and correct shaping).
- Running log: `PROGRESS.md` records phase, tasks done, gate status, and blockers
  so work survives context resets.
- Consult Context7 for current Next.js/zod/zustand/shadcn/apexcharts/pdfkit APIs
  when touching their integration points instead of relying on memory.

## Governance

- This constitution supersedes conflicting practices; violations fail review.
- Amendments: document the change, bump the version (MAJOR for principle
  removals/redefinitions, MINOR for additions/expansions, PATCH for clarifications),
  and record it in the Sync Impact Report.
- Compliance review: every phase gate must check principles I–VII; the P0 login gate
  is the executable enforcement of Principles I–II and the P3 PDF gate enforces
  Principle VII shaping requirements.

**Version**: 1.0.1 | **Ratified**: 2026-09-11 | **Last Amended**: 2026-09-11
