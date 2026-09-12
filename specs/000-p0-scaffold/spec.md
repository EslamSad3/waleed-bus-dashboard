# Feature Specification: P0 Scaffold — shell, theme, login, proxy, session, pdfkit spike

**Feature Branch**: `000-p0-scaffold`

**Created**: 2026-09-11

**Status**: Draft

**Input**: PRD `D:/Eslam/waleed/bus/bus_dashboard/PRD.md` §§1–5, 7, 9–11 (P0 scope only).
Backend contract: `D:/Eslam/waleed/bus/bus_api/docs/openapi.json`. Backend MUST NOT be modified.

## Clarifications

### Session 2026-09-11 (implementation grounding amendments)

- Q: Platform login identifier — phone (PRD §5.2) or email (backend)? → A: **email + password** (no `loginType`). Backend `login()` resolves users by lowercased email only; phone flows are PASSENGER/FLEET_OWNER/DRIVER. Contract fidelity (Principle III) wins over the PRD assumption; PRD §5.2/§6.1 phone rule is superseded for super_admin.
- Q: Session identity shape — `{id, name, app_role}`? → A: No — `GET /auth/me` returns `CurrentUserDto` `{id, email, appRole, authVersion, sessionId}` (no `name`). Store is `{id, email, appRole}`; guard checks `appRole === 'super_admin'` (`app_role` lives inside the JWT only).
- Q: rememberMe lifetimes given backend 7-day rotating refresh? → A: Amends earlier answer — unchecked (default) = session refresh cookie (no Max-Age); checked = persistent refresh cookie capped at 7 days (backend window); access stays short-lived either way.

### Session 2026-09-11

- Q: If the pdfkit spike FAILs shaping, does the P0 gate fail? → A: No — FAIL recorded with fallback decision, P0 passes conditionally; a proven PDF path is the entry gate for P3 (Option B).
- Q: Does P0 build the full generic proxy forwarder or only needed routes? → A: Full generic `[...proxy]` forwarder in P0; P1 adds only per-resource zod schemas (Option A).
- Q: What does "تذكرني" (rememberMe) change? → A: Unchecked (default) = session refresh cookie (no Max-Age); checked = 30-day persistent refresh cookie; access stays short-lived (Option A). — SUPERSEDED by grounding amendment above (7-day cap).
- Q: How is the spike PASS judged? → A: Human visual inspection (operator opens the PDF), verdict recorded as explicit PASS/FAIL in the P0 gate.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Super-admin login/logout (Priority: P1)

Arabic-RTL login at `(auth)/login` with **email + password** + show/hide toggle
(backend platform login resolves by email; no `loginType` is sent).
Only `appRole === 'super_admin'` (from `GET /auth/me`) enters `(shell)`;
everyone else sees the generic error and stays out. Logout clears httpOnly
cookies via proxied `POST /auth/logout`.

**Why this priority**: Without the gate nothing else is reachable; it is the
executable enforcement of constitution Principles I–II.

**Independent Test**: Against locally running `bus_api`: valid super_admin
credentials → `/` overview; wrong credentials / non-super_admin → generic
"بيانات الدخول غير صحيحة"; logout → `/login`; direct `(shell)` URL while
anonymous → `/login`.

**Acceptance Scenarios**:

1. **Given** anonymous at `/login`, **When** submitting valid super_admin email +
   password, **Then** session cookies set httpOnly and redirect to `/`.
2. **Given** anonymous at `/login`, **When** submitting wrong credentials or a
   non-super_admin identity, **Then** "بيانات الدخول غير صحيحة" shows and no
   session is created.
3. **Given** authenticated super_admin, **When** opening any `(shell)` route then
   logging out, **Then** cookies cleared and next `(shell)` visit redirects to
   `/login`.
4. **Given** throttled (429) or unreachable backend, **When** logging in,
   **Then** "محاولات كتير، حاول بعد شوية" or "مشكلة في الاتصال بالسيرفر" shows.

---

### User Story 2 — Proxied API access + health (Priority: P1)

Browser calls same-origin `/api/*`; the route handler attaches the JWT
server-side and forwards to `BUS_API_URL`. `GET /api/health` proxies
`GET /health` (`{statusCode, data:{status}}`). 401 triggers single-flight
`POST /auth/refresh`, retry once, else clear cookies → 401 → `/login`.

**Why this priority**: Proves the proxy contract all later phases depend on.

**Independent Test**: `GET /api/health` returns backend status without exposing
`BUS_API_URL` or tokens to the client; expired access + valid refresh recovers
once; expired refresh redirects to login.

**Acceptance Scenarios**:

1. **Given** valid session, **When** `GET /api/health`, **Then** 200 with
   backend `{status:'ok'}` and no token leakage in response/client bundle.
2. **Given** expired access + valid refresh, **When** calling `/api/health`,
   **Then** one refresh + retry succeeds without user action.
3. **Given** expired/invalid refresh, **When** calling any `/api/*`,
   **Then** cookies cleared, 401 to client, redirect `/login`.

---

### User Story 3 — RTL shell with arrw identity (Priority: P2)

`<html lang="ar" dir="rtl">`, Cairo (Arabic) + Poppins (Latin/digits) via
`next/font/google`, PRD §3 tokens (page gradient, `#2f719e` primary,
amber/blue tinted cards, navy band, `#000557` dark bg reserved), light
topbar/sidebar + `(shell)` layout + placeholder overview page with gradient
headline, stat-card row, and navy CTA band skeleton.

**Why this priority**: Visual/RTL foundation every screen builds on.

**Independent Test**: Visual pass: RTL direction, Cairo/Poppins loaded, gradient
headline + tinted cards + navy band render; keyboard navigation + Arabic
`aria-label`s present; `loading.tsx` skeleton shows on slow nav.

**Acceptance Scenarios**:

1. **Given** any page, **When** inspecting `<html>`, **Then** `lang="ar"`
   `dir="rtl"` and Cairo/Poppins fonts applied.
2. **Given** `/` overview skeleton, **When** rendered, **Then** gradient
   headline, KPI card row, and navy band match PRD §3 tokens.

---

### User Story 4 — pdfkit Arabic-shaping spike (Priority: P1, blocking)

Route handler `GET /api/reports/spike` generates a one-page pdfkit PDF with
embedded Cairo font containing Arabic prose + digits + a table header, proving
correct glyph shaping (letters joined, RTL order) before P3 templates are built.
Fallback decision (headless-HTML render) recorded if shaping fails.

**Why this priority**: Biggest v1 risk (PRD §7, §12); blocks all PDF work.

**Independent Test**: Human visual inspection — download spike PDF, open it,
visually verify joined Arabic and RTL order; report PASS/FAIL explicitly in P0 gate.

**Acceptance Scenarios**:

1. **Given** `GET /api/reports/spike`, **When** downloaded and opened,
   **Then** Arabic renders shaped/ordered correctly with embedded Cairo font.

### Edge Cases

- Phone not matching `^01[0-9]{9}$` or password < 8 → inline Egyptian-Arabic
  error before any network call. (P1+ fleet/passenger forms; P0 super_admin login
  uses email validation "اكتب بريد إلكتروني صحيح" + password min 8.)
- Backend envelope `{statusCode, data}` unwrapped once in proxy; lists stay
  cursor-shaped (`{items, nextCursor}`) — never converted to offset paging.
- 404 surfaced as "العنصر مش موجود في الأسطول ده", never as "no permission".
- Mutations check `Origin`; GETs use `cache: no-store`.
- `BUS_API_URL`/tokens never appear in client bundle (verified by search).
- Spike FAIL → P0 passes conditionally; P3 MUST NOT start without a proven PDF
  path (pdfkit fixed or HTML fallback proven).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST scaffold Next.js@latest App Router + TypeScript strict
  app in `bus_dashboard/` with `app/layout.tsx` (fonts, RTL, theme).
- **FR-002**: System MUST provide `(auth)/login` (email+zod-email, password
  min 8, no `loginType`) proxying `POST /auth/login` with generic failure copy.
- **FR-003**: System MUST store access+refresh JWTs in httpOnly cookies only and
  hydrate zustand session (`id`, `email`, `appRole`) via `GET /auth/me`.
  "تذكرني" (default unchecked): unchecked → session refresh cookie (no Max-Age);
  checked → persistent refresh cookie capped at 7 days (backend window); access
  stays short-lived either way.
- **FR-004**: System MUST guard `(shell)` via `proxy.ts` (Next.js 16
  convention; formerly `middleware.ts`) AND `(shell)/layout.tsx` on
  `appRole === 'super_admin'` (from `GET /auth/me`).
- **FR-005**: System MUST provide generic `app/api/[...proxy]/route.ts`
  forwarder (JWT attach, envelope unwrap, §9 error map, refresh-retry-once,
  `Origin` check on mutations, `no-store` GETs, zod re-validation) in P0,
  proved via the auth/health traffic; P1 adds only per-resource zod schemas.
- **FR-006**: System MUST expose `GET /api/health` → backend `GET /health`.
- **FR-007**: System MUST ship `GET /api/reports/spike` pdfkit+Cairo proof PDF
  and record PASS/FAIL + fallback decision.
- **FR-008**: System MUST apply PRD §3 theme tokens + shadcn `new-york` mapping
  (`--primary:#2f719e`, radius `1rem`) + `loading.tsx` skeletons.
- **FR-009**: Logout MUST proxy `POST /auth/logout` and clear cookies.
- **FR-010**: P0 MUST NOT modify `bus_api`; gaps become `bus_api` change requests.

### Key Entities *(P0 session/data shapes — no new DB tables)*

- **Session**: `{ id, email, appRole }` from `GET /auth/me` (`CurrentUserDto`)
  → zustand `stores/session.ts`; `appRole` gate value (JWT carries `app_role`).
- **ProxyError**: `{statusCode, code, message, details?}` → mapped to PRD §9
  Egyptian-Arabic copy in `lib/errors.ts`.
- **CursorPage**: `{items, nextCursor}` opaque base64url, `limit=20` default,
  "عرض المزيد" affordance (carried, not fully consumed, in P0).
- **SpikePdf**: one-page pdfkit doc, embedded Cairo, filename
  `تقرير-spike-<date>.pdf`.

## Success Criteria *(mandatory)*

- **SC-001**: super_admin logs in/out against local `bus_api`; non-super_admin
  rejected with generic message (US1 test passes).
- **SC-002**: `/api/health` proxies with no secret leakage; refresh-retry
  behaves per US2.
- **SC-003**: Spike PDF downloads with correctly shaped Arabic (explicit
  PASS/FAIL reported; on FAIL, P0 passes conditionally with the HTML-fallback
  decision recorded, and a proven PDF path becomes the P3 entry gate).
- **SC-004**: `tsc --noEmit` + eslint clean on the scaffold.

## Assumptions

- `bus_api` runs locally (`BUS_API_URL`, default `:3000`) with a seeded
  super_admin; `docs/openapi.json` is current.
- pnpm + Node 24; Tailwind v4 + shadcn available at scaffold.
- Cairo TTF obtainable for `PDF_FONT_PATH`; HTML-render fallback acceptable.
- Single `ar` locale; Western digits in tables.
