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
- **Exact commands**: `pnpm install`, `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm build`
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
**Platform-first routing**: All fleet CRUD under `/fleets/{fleetId}/buses|trips|bookings`. Tenant lifecycle actions (`disable/reactivate`, `assign driver`) require tenant path + `x-fleet-id` header only.

**Proxy contract**: Browser calls same-origin `/api/*` with session cookie → proxy attaches JWT, forwards to `BUS_API_URL`, unwraps `{statusCode, data}`, maps backend codes to Arabic messages (PRD §9).

### 3.2 Authentication Flow
1. Login: `POST /auth/login` (phone + password, Egyptian mobile regex `^01[0-9]{9}$`)
2. Store access (~15m): httpOnly cookies (`sa_access`, `sa_refresh`)
3. Identity: `appRole === 'super_admin'` checked on `(shell)/layout.tsx` via `GET /auth/me`
4. Logout: `POST /auth/logout` + clear cookies

### 3.3 Error Code Map (PRD §9)
| Code | Message |
|---|---|
| `AUTHENTICATION_FAILED` | بيانات الدخول غير صحيحة |
| `BUS_ACTION_NOT_ALLOWED` | العملية مرفوضة: الأتوبيس عليه رحلة شغالة (DEPARTED) |
| `DRIVER_ASSIGNMENT_NOT_ALLOWED` | تعيين السواق مرفوض: مش نشط أو من أسطول تاني |
| `RESOURCE_NOT_OWNED` / 404 | العنصر مش موجود في الأسطول ده |
| `CONFLICTING_ASSIGNMENT` | البيانات متعارضة مع سجل موجود |
| `VALIDATION_FAILED` | راجع الحقول المطلوبة |
| 429 | محاولات كتير، حاول بعد شوية |

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
2. **P1 platform CRUD**: fleets, buses (+trips tab), trips, bookings, members
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
