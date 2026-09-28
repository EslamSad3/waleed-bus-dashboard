<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Bus Platform Super-Admin Dashboard

## Overview

This file defines the high-signal constraints, architecture patterns, and operational rules that must be followed during OpenCode sessions for this repository.

---

## 1. Investigation Priorities

### Read in this order:
1. **PRD.md** — Single source of truth for requirements, behavior, and acceptance criteria
2. **PROGRESS.md** — Current state, P0/P1 gate evidence, verified behaviors
3. **packages/* config files**:
   - `package.json` (scripts, dependencies)
   - `pnpm-workspace.yaml` (monorepo scope)
   - `tsconfig.json` (compiler options, paths)
4. **`.cursorrules/**** and `.cursor/` rules** — UI/UX conventions and component patterns
5. **`opencode.json`** (if exists) — Any OpenCode-specific settings

### If architecture is unclear after config review:
- Inspect `app/(shell)/page.tsx`, `app/layout.tsx`, `lib/api.ts`, `lib/auth.ts` for the entry points
- Read `PROGRESS.md` gate evidence to understand what's been verified and what blocks next phases

---

## 2. What to Extract

### Must capture:
- **Exact commands**: `pnpm install`, `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check`, `pnpm build`
- **Verification flow**: `lint → typecheck → test` order and dependencies
- **Monorepo boundaries**: Which packages belong to which workspace
- **Framework quirks**: Next.js 16 App Router, RSC-first rendering, pnpm-only
- **Testing quirks**: cursor pagination contract, load-more behavior, error format `{statusCode, code, message}`
- **Critical constraints**: Arabic RTL + Egyptian dialect only, backend contract fidelity

### Should reference (don't duplicate):
- `PRD.md` functional requirements (§§6–12)
- `PROGRESS.md` gate evidence and blockers
- `.specify/constitution.md` core principles I–VII
- Existing spec files: `specs/000-p0-scaffold/*`, `specs/001-platform-crud/*`, `specs/002-ag-grid-tables/*`

---

## 3. High-Signal Rules

### 3.1 Architecture Pattern
**Platform-first routing**: All fleet CRUD under `/fleet-owners/fleets/{fleetId}/buses|trips|bookings|members` (spec 014 moved the whole fleet surface under the fleet-owner namespace; the `fleetId` param must keep that name — the API's `TenantContextGuard` resolves the tenant from it). Tenant lifecycle actions (`disable/reactivate`, `assign driver`) require tenant path + `x-fleet-id` header only.

**One screen for owners and companies**: there is no `/fleets` route any more. `/fleet-owners` lists owners with their companies inline; `/fleet-owners/[id]` has *Account* and *Companies* tabs, and a company expands inline (summary + Buses/Members/Trips/Bookings/Reports). Opening a company is what sets the fleet scope the `/fleet/*` calls need — the old route did this in a mount effect. `next.config.ts` 308-redirects `/fleets` and `/fleets/:id` (the latter to `/fleet-owners?fleet=:id`).

**Proxy contract**: Browser calls same-origin `/api/*` with session cookie → proxy attaches JWT, forwards to `BUS_API_URL`, unwraps `{statusCode, data}`, maps backend codes to Arabic messages (PRD §9). The zod registry in `lib/schemas/p1.ts` is keyed on the **backend** path, so it must be updated whenever an API route moves.

### 3.2 Authentication Flow
1. Login: `POST /auth/login` (phone + password, Egyptian mobile regex `^01[0-9]{9}$`)
2. Store access (~15m): httpOnly cookies (`sa_access`, `sa_refresh`)
3. Identity: `appRole === 'super_admin'` checked on `(shell)/layout.tsx` via `GET /auth/me`
4. Logout: `POST /auth/logout` + clear cookies

### 3.3 Error Code Map (PRD §9)
`lib/errors.ts` binds a backend code to a dictionary key; the copy itself is in `lib/i18n/ar.json` under `errors.*`.

| Code | Key | Message |
|---|---|---|
| `AUTHENTICATION_FAILED` | `errors.AUTHENTICATION_FAILED` | بيانات الدخول غير صحيحة |
| `BUS_ACTION_NOT_ALLOWED` | `errors.BUS_ACTION_NOT_ALLOWED` | العملية مرفوضة: الأتوبيس عليه رحلة شغالة (DEPARTED) |
| `DRIVER_ASSIGNMENT_NOT_ALLOWED` | `errors.DRIVER_ASSIGNMENT_NOT_ALLOWED` | تعيين السواق مرفوض: مش نشط أو من شركة تانية |
| `RESOURCE_NOT_OWNED` / 404 | `errors.RESOURCE_NOT_OWNED` | العنصر مش موجود في الشركة دي |
| `CONFLICTING_ASSIGNMENT` | `errors.CONFLICTING_ASSIGNMENT` | البيانات متعارضة مع سجل موجود |
| `VALIDATION_FAILED` | `errors.VALIDATION_FAILED` | راجع الحقول المطلوبة |
| 429 | `errors.RATE_LIMITED_429` | محاولات كتير، حاول بعد شوية |

### 3.3b i18n (single source of truth)
- **All user-facing Arabic copy lives in `lib/i18n/ar.json`.** Nothing is hardcoded in pages, components, libs or server actions.
- Read it with `t("dotted.key")` from `@/lib/i18n/t` — isomorphic, so it works in server components, client components, plain libs and action modules: `t("bookings.detail.title")`, `t("buses.list.rowActions", { name })`.
- Keys are type-checked: a typo or a missing key fails `pnpm typecheck`. Values may contain `{placeholder}` slots.
- Dictionary sections: `common` (shared actions/fields/values), `enums` (backend enum labels), `errors`, `validation` (zod messages), `agGrid`, `colors`, `ordinals`, then one section per screen/feature.
- `pnpm i18n:check` fails when Arabic is hardcoded outside `ar.json`, when a `t()` key is missing, and lists unused keys. Run it with `lint` + `typecheck` as the dashboard gate.
- Adding a locale: drop `<locale>.json` beside `ar.json` and resolve the dictionary per request in `lib/i18n/t.ts` — nothing else needs to change.

### 3.4 PDF Reports (PRD §7)
- Route: `GET /api/reports/fleet`, `GET /api/reports/trip`, `GET /api/reports/digest`
- Engine: `pdfkit` + embedded Cairo (`PDF_FONT_PATH`) + `bidi-shaper/pdfkit` `textBidi`, `direction: rtl`
- Filename: `تقرير-scope-{YYYY-MM-DD}.pdf`

### 3.5 Data Contract
- Lists use **cursor pagination**: `?cursor=&limit=`, response `{items, nextCursor}` (default `limit=20`)
- No offset pagination; no page counts in API contract
- Client-side grid pagination layered over loaded rows per spec `specs/002-ag-grid-tables/data-model.md`

---

## 4. Technical Constraints

### Framework & Tools
| Category | Decision |
|---|---|
| Framework | Next.js@16, App Router, RSC-first, single `ar` locale |
| Language | TypeScript `strict` |
| UI | shadcn (`new-york`, `lucide-react`) + Tailwind |
| Forms | react-hook-form + shadcn `ui/form` + zod@latest |
| State | zustand@latest (`stores/session.ts`, `stores/filters.ts`) |
| Charts | apexcharts + react-apexcharts (client-only, `ssr:false`) |
| PDFs | pdfkit with embedded Cairo font |
| Pnpm | workspace lock enforced; `allowBuilds: unrs-resolver: true` |

### Session & Security
- **Cookies only**: `sa_session`, `sa_access`, `sa_refresh` (httpOnly, Secure, SameSite=Lax)
- **Never localStorage**: tokens must not appear in client bundle or storage
- **Proxy boundary**: every mutation validated with zod inside route handler

---

## 5. Development Workflow

### Phase Order (MUST follow):
1. **P0 scaffold**: Next.js + shadcn + Cairo/Poppins + RTL + login + proxy + session store + pdfkit Arabic spike
2. **P1 platform CRUD**: fleet owners + their companies, buses (+trips tab), trips, bookings, members
3. **P2 governance**: users, roles/permissions matrix, audit viewer
4. **P3 reports + PDFs**: 3 PDF templates with real data and correct shaping
5. **P4 hardening**: error map, empty states, dark mode, README

### Verification per Phase:
```bash
pnpm dev
pnpm typecheck
pnpm lint
```

Gate walkthrough against locally running `bus_api` (login/logout as super_admin; CRUD with 409/404 Arabic messages).

---

## 6. Known Issues & Blockers

### P0 Spike Failures:
- **pdfkit Arabic shaping**: mitigated with HTML fallback in `lib/pdf/spike.ts`; visual confirmation pending

### Backend Dependencies (out of scope):
- Cursor pagination totals → separate `bus_api` change request
- Roster invite 409 (`DRIVER_ASSIGNMENT_NOT_ALLOWED`) → backend clarification needed

---

## 7. References

| Topic | File(s) |
|---|---|
| PRD requirements | `PRD.md` (§§1–288) |
| Constitution principles | `.specify/memory/constitution.md` (principles I–VII) |
| P0 spec | `specs/000-p0-scaffold/spec.md`, `tasks.md`, `plan.md` |
| P1 spec | `specs/001-platform-crud/spec.md`, `data-model.md` |
| AG Grid spec | `specs/002-ag-grid-tables/spec.md`, `data-model.md`, `grid-ui.md` |
| Quickstart docs | `specs/002-ag-grid-tables/quickstart.md` |
| Architecture | `app/layout.tsx`, `lib/api.ts`, `PROGRESS.md` |

---

## 8. Open Questions (Do NOT ask unless repo is unclear)

- **None** — All critical decisions are documented in PRD, PROGRESS, and spec files
