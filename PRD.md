# PRD — Bus Platform Super-Admin Dashboard (`bus_dashboard`)

| Field | Value |
|---|---|
| Status | Approved for build (P0 first) |
| Owner | Platform team |
| App location | `D:\Eslam\waleed\bus\bus_dashboard` (sibling of `bus_api`, separate Next.js app) |
| Backend | `bus_api` (NestJS 12 + Prisma 7, base URL via `BUS_API_URL`) |
| UI language | **Arabic (Egyptian dialect) only, RTL** |
| API strategy | **Next.js API-route proxy** (browser never holds JWTs) |
| PDF scope v1 | **Reports** (fleet summary, trip manifest/settlement, reports digest) |

---

## 1. Vision

A fully Arabic RTL web dashboard where a **`super_admin`** manages the entire multi-tenant bus platform from one place: fleets, buses, trips, bookings, drivers/owners, users, roles/permissions, passenger reports & ratings, and audit logs. The super_admin uses the backend **platform path** (`@Platform()`, system Prisma over `DIRECT_URL`, RLS bypassed by design) — so the dashboard must verify `app_role === super_admin` on every guarded surface and never leak platform routes to other roles.

### 1.1 Goals (v1)

1. Full platform CRUD for every backend resource without touching Swagger/curl.
2. Operational oversight: KPIs, charts, per-fleet and per-trip visibility.
3. Governance: roles/permissions, user admin, immutable audit trail viewer.
4. Arabic PDF reports generated server-side.
5. arrw.com visual identity (tokens cloned, §3).

### 1.2 Explicit non-goals (v1)

Fleet-owner self-service, driver views, passenger app, live GPS tracking, online payments, notifications center, multi-language UI.

---

## 2. Users & access

| Actor | Access |
|---|---|
| `super_admin` | Everything below. Only actor allowed past login. |
| Any other role / anonymous | Login rejected with the generic error; `(shell)` routes redirect to `/login`. |

Backend rules the dashboard must respect and surface in UI copy:

- Failures use generic `AUTHENTICATION_FAILED` (never distinguish unknown user vs wrong password vs wrong account type).
- `system` role is immutable (disable edit/delete buttons with tooltip).
- The last active `super_admin` cannot be demoted/deactivated/deleted (backend 409 — show the message, don't hide the button silently).
- Cross-fleet lookups return 404, never 403 (dashboard must not reinterpret 404 as "no permission").
- Disable-bus blocked while a DEPARTED trip runs → 409 `BUS_ACTION_NOT_ALLOWED`.
- Security-sensitive roster changes bump `authVersion` and revoke sessions (warn the operator before suspend/revoke/remove).

---

## 3. Design system — arrw.com clone

Tokens extracted from the live arrw.com CSS (Angular + Tailwind, `Poppins` + `Cairo`, `dir=rtl` switches to Cairo).

### 3.1 Typography

- Arabic: **`Cairo`** variable font, weight 200–1000. Body 400–500, headings 700–800.
- Latin/digits: **`Poppins`** 100–900.
- `<html lang="ar" dir="rtl">`; load both families via `next/font/google`.

### 3.2 Color palette (light = default)

| Token | Value | Usage |
|---|---|---|
| `--page-bg` | `linear-gradient(270deg,#e8e8ec 0%,#e9efff 50%,#fff 100%)` | App background |
| `--ink` | `#1a1a1a` | Titles, navbar items |
| `--title-grad-1` | `linear-gradient(91deg,#3e95d1 .74%,#204c6b 95.01%)` | Gradient headlines |
| `--title-grad-2` | `linear-gradient(90deg,#10153c 57.8%,#999 99.99%)` | Alt headlines |
| `--muted` | `#919191` | Descriptions, placeholders |
| `--body-gray` | `#6b6868` / `#606060` | Body copy, footer text |
| `--card-amber` | `#fff7e3` | Tinted stat cards |
| `--card-blue` | `#daeaf5` (hover `#c4def3`) | Tinted cards, hover states |
| `--navy-band` | `linear-gradient(270deg,#0a1020,rgba(9,17,52,.85),rgba(0,30,62,.82))` | CTA band, dark sections |
| `--primary` | `#2f719e` | CTAs, links, active nav |
| `--navy` | `#10153c` / `#0e0b2c` | Dark headings |
| `--contact` | `#262626` | Emphasis copy |

Dark mode: page bg `#000557`, same accent ramp.

### 3.3 shadcn mapping (`globals.css` variables)

`--primary:#2f719e` · `--secondary:#daeaf5` · `--accent:#fff7e3` · `--foreground:#1a1a1a` · `--muted-foreground:#606060` · `--radius:1rem`. shadcn style `new-york`, icons `lucide-react`.

### 3.4 Signature components (must build)

1. Gradient headline + stat-card row on home (arrw hero language).
2. Rounded-2xl tinted KPI cards (alternate amber/blue tints).
3. Navy CTA band (e.g. reports shortcut strip).
4. Light topbar/sidebar, dark text; gray footer line.
5. Donut/area/line charts in brand blues (`#3e95d1`, `#2f719e`, `#204c6b`, `#10153c`).

---

## 4. Tech stack (pinned at scaffold)

| Concern | Decision |
|---|---|
| Framework | **Next.js@latest**, App Router, RSC-first, single `ar` locale |
| Language | TypeScript `strict` |
| UI | **shadcn** + Tailwind + `lucide-react` |
| Forms | **react-hook-form** + shadcn `ui/form` + **`zod@latest`** + `@hookform/resolvers/zod` |
| Client state | **`zustand@latest`** (`stores/session.ts`, `stores/filters.ts`) + URL search params for list filters |
| Server data | Server Components via `lib/api.ts`; mutations via Server Actions → API routes |
| Charts | **apexcharts** + `react-apexcharts`, client-only (`next/dynamic`, `ssr:false`) |
| PDFs | **pdfkit** in Route Handlers, embedded Cairo font for Arabic |
| Session | httpOnly cookies (`sa_session`); never localStorage |
| Quality gates | `tsc --noEmit`, eslint, manual walkthrough per phase |

---

## 5. Architecture

```
bus_dashboard/
  app/
    layout.tsx                  # fonts (Cairo+Poppins), dir=rtl, theme
    (auth)/login/page.tsx       # super_admin login
    (shell)/layout.tsx          # sidebar + topbar, auth-guarded
    (shell)/page.tsx            # overview (KPIs + charts)
    (shell)/fleets/...          # list / [id] (tabs) / new
    (shell)/buses/...           # list / [id] (incl. trips tab) / new
    (shell)/trips/...           # list / [id]
    (shell)/bookings/...        # list / [id]
    (shell)/drivers/...         # roster (users + memberships + assignments)
    (shell)/users/...           # list / [id] / new
    (shell)/roles/...           # list / [id] (permission matrix)
    (shell)/reports/...         # incidents + ratings + PDF export
    (shell)/audit/...           # audit log viewer
    (shell)/settings/page.tsx   # API health, session, theme
    api/
      [...proxy]/route.ts       # generic proxy → BUS_API_URL
      reports/[scope]/route.ts  # pdfkit generators
  lib/ (api.ts, auth.ts, schemas.ts, errors.ts, pdf/) 
  components/ (ui/*, charts/*, tables/*, fleet-scope-select.tsx)
  stores/ (session.ts, filters.ts)
  middleware.ts                 # shell guard
```

### 5.1 Proxy contract (`/api/[...proxy]`)

- Browser calls same-origin `/api/*` with session cookie; route handler attaches the super_admin access JWT and forwards to `BUS_API_URL`.
- Unwraps backend envelope `{statusCode, data}`; maps backend `code`s to Egyptian-Arabic messages (§9).
- On 401: single-flight `POST /auth/refresh`, retry once, else clear cookies → 401 to client → redirect `/login`.
- Mutations check `Origin`; GETs set `cache: no-store`.
- All input validated with zod in the route handler (trust boundary), even when the form already validated client-side.

### 5.2 Auth flow

1. Login form: `phone` + `password` (zod: E.164-ish Egyptian mobile regex `^01[0-9]{9}$`, password min 8).
2. Proxy `POST /auth/login` (platform admin has no `loginType` split — backend decides by role; surface generic error on failure).
3. Store access (~15m) + refresh tokens in httpOnly cookies; `GET /auth/me` → zustand session (`id`, `name`, `app_role`).
4. `middleware.ts` + `(shell)/layout.tsx` require `app_role === 'super_admin'`.
5. Logout: proxy `POST /auth/logout` + clear cookies.

### 5.3 Pagination & envelope

Backend uses cursor pagination (`?cursor=&limit=`, response `{items, nextCursor}`) on every list. Dashboard mirrors it: "عرض المزيد" load-more button, default `limit=20`, `nextCursor` base64url opaque — never decoded client-side. Errors arrive as `{statusCode, code, message, details?}`.

---

## 6. Functional requirements

### 6.1 Login (`POST /auth/login`)

- Fields: phone, password, show/hide toggle, "تذكرني" optional (extends refresh cookie).
- Errors: wrong credentials → "بيانات الدخول غير صحيحة"; throttled (429) → "محاولات كتير، حاول بعد شوية"; network failure → "مشكلة في الاتصال بالسيرفر".
- Success → `/` overview.

### 6.2 Overview (`/`)

- KPI cards: Fleets, Buses, Active (DEPARTED) trips, Bookings today, Avg bus/driver rating.
- ApexCharts: bookings over time (area, filterable 7/30 days), trips by status (donut: SCHEDULED/DEPARTED/COMPLETED/CANCELLED), ratings trend (line), top fleets table (name, buses, trips, avg rating).
- Sources: `GET /fleets`, `GET /fleet/reports`, per-fleet aggregates via proxy.

### 6.3 Fleets (`/fleets`, `/fleets/new`, `/fleets/[id]`)

- List (`GET /fleets`): search by name, active filter, cursor load-more.
- Create (`POST /fleets`): name, owner (user picker), optional initial membership.
- Detail tabs: Overview · Buses · Trips · Members · Bookings · Reports.
- Edit (`PATCH /fleets/:id`), activate/deactivate, delete (`DELETE /fleets/:id`) with 409 guard message when buses/trips/bookings still reference it.

### 6.4 Buses (`/buses`, `/buses/new`, `/buses/[id]`)

- Fleet-scope selector (persisted in zustand + cookie → sent as `x-fleet-id` on tenant-path calls).
- List/detail via `/fleets/:fleetId/buses*`; create (`registrationNumber` unique-per-fleet → 409 message "رقم التسجيل مستخدم قبل كده"), edit plate/capacity.
- Actions: disable/reactivate (409 when DEPARTED trip blocks: "الأتوبيس عليه رحلة شغالة"); assign/unassign driver (`POST/DELETE /fleet/buses/:busId/driver`, idempotent messaging).
- **Per-bus trips tab** (`GET /fleet/buses/:busId/trips`).

### 6.5 Trips (`/trips`, `/trips/[id]`)

- List (`GET /fleet/trips` + fleet filter): filter by status, origin/destination search, date range.
- Detail (`GET /fleet/trips/:tripId`): route, bus, schedule, status timeline, bookings manifest link, cancel action.

### 6.6 Bookings (`/bookings`, `/bookings/[id]`)

- List (`GET /fleets/:fleetId/bookings`): filter by trip/status/payment, search passenger name/phone.
- Detail: timeline (confirmed → boarded → dropped, payment PAID + method echo, ratings 1–5 per side), cancel booking.

### 6.7 Drivers & owners (`/drivers`)

- Users list (`GET /users`): search, verified/active filters, create user, edit, activate/deactivate.
- Fleet members (`GET /fleets/:fleetId/members*`): invite driver (existing user or fresh phone+name+password), change role/status **with pre-action warning** ("هيقفل جلسات السواق"), remove (ends membership + active assignment).
- Assignment history per bus (ACTIVE/ENDED rows).

### 6.8 Reports (`/reports`)

- Filters: type (`passenger_reports`|`ratings`), trip, date from/to (`GET /fleet/reports`).
- Incident list (append-only; no edit/delete UI), rating summary cards (busAvg, driverAvg, count) + ApexCharts trend.
- **PDF export buttons** → §7.

### 6.9 Users / Roles / Permissions (`/users`, `/roles`)

- Roles list/detail (`GET /roles`, `/roles/:id`): permission matrix UI (`GET /permissions`, `PUT /roles/:id/permissions`), create/edit/deactivate role.
- System role: buttons disabled + tooltip "دور النظام مينفعش يتعدل".
- User roles tab (`GET /users/:id`, `/users/:id/roles`): assign/revoke with last-super_admin 409 handling.

### 6.10 Audit (`/audit`)

- List (`GET /audit-logs`): filter actor/action/resource/date range, cursor load-more.
- Row drawer: full metadata JSON (Arabic labels for known keys), actor/target links.
- CSV export (client-side from loaded pages).

### 6.11 Settings (`/settings`)

- API health (`GET /health`), current session info, theme toggle (light/dark), fleet-scope default, sign-out-everywhere.

---

## 7. PDF reports (pdfkit, Route Handlers)

| Template | Route | Contents |
|---|---|---|
| Fleet summary | `GET /api/reports/fleet?fleetId=` | Fleet info, counts (buses/trips/bookings/members), rating averages, top trips table |
| Trip manifest/settlement | `GET /api/reports/trip?tripId=` | Trip header, passenger manifest, board/drop status, payments collected, ratings |
| Reports digest | `GET /api/reports/digest?fleetId=&from=&to=` | Incidents list + rating summary |

- Arabic RTL with embedded Cairo font; filename `تقرير-<scope>-<date>.pdf`.
- **Phase-0 spike (blocking)**: prove Arabic glyph shaping in pdfkit; fallback = headless-HTML render if shaping fails.

---

## 8. Forms & validation (zod + react-hook-form)

- Every form: zod schema in `lib/schemas/*.ts` (shared with route handler), shadcn `Form` components, inline Egyptian-Arabic errors, server `details.fields` mapped back onto fields.
- Canonical messages: required "الحقل ده مطلوب" · invalid phone "رقم الموبايل لازم يبقى 11 رقم يبدأ بـ 01" · capacity "السعة من 1 لـ 300" · rating "التقييم من 1 لـ 5".

---

## 9. Backend error-code map (Arabic)

| Code | Message |
|---|---|
| `AUTHENTICATION_FAILED` | بيانات الدخول غير صحيحة |
| `BUS_ACTION_NOT_ALLOWED` | العملية مرفوضة: الأتوبيس عليه رحلة شغالة (DEPARTED) |
| `DRIVER_ASSIGNMENT_NOT_ALLOWED` | تعيين السواق مرفوض: مش نشط أو من أسطول تاني |
| `RESOURCE_NOT_OWNED` / 404 | العنصر مش موجود في الأسطول ده |
| `CONFLICTING_ASSIGNMENT` | البيانات متعارضة مع سجل موجود (راجع الحقول) |
| `VALIDATION_FAILED` | راجع الحقول المطلوبة |
| 403 missing scope | اختار الأسطول الأول (x-fleet-id) |
| 429 | محاولات كتير، حاول بعد شوية |

---

## 10. Non-functional requirements

- **Perf**: RSC + `loading.tsx` skeletons; charts lazy (`next/dynamic`); lists default 20; proxy responses `no-store` except dictionaries (5-min cache).
- **Security**: super_admin-only guard (middleware + layout double-check); httpOnly cookies + `Secure`/`SameSite=Lax`; `Origin` check on mutations; no `BUS_API_URL`/tokens in client bundle; every mutation toast shows the audited action.
- **A11y**: `lang="ar" dir="rtl"`, focus-visible rings, keyboard-navigable tables/dialogs, `aria-label`s in Arabic.
- **Env**: `BUS_API_URL` (server-only), `SESSION_COOKIE_SECRET`, `PDF_FONT_PATH`, `NEXT_PUBLIC_APP_NAME`.
- **Copy**: Egyptian-dialect deck lives at `specs/dashboard/copy-ar-EG.md` (author in P0); Western digits inside tables, Arabic labels.

---

## 11. Delivery phases & acceptance

- **P0 scaffold**: Next.js + shadcn + Cairo/Poppins + RTL + theme tokens + login + proxy + session store + pdfkit Arabic spike.
  *Accept*: login/logout as super_admin against local API; `/api/health` proxies; spike PDF renders9650 Arabic correctly.*
- **P1 platform CRUD**: fleets, buses (+trips tab), trips, bookings, members.
  *Accept*: full CRUD walkthrough per module, 409/404 Arabic messages verified.*
- **P2 governance**: users, roles/permissions matrix, audit viewer, overview charts.
  *Accept*: permission change reflects in matrix; audit row appears for each mutation; charts render with empty states.*
- **P3 reports + PDFs**: reports screens + 3 PDF templates.
  *Accept*: each PDF downloads with correct Arabic shaping and real data.*
- **P4 hardening**: error map, empty states, dark mode, copy review, README + deploy notes.
  *Accept*: `tsc + eslint` clean, full click-through, docs committed.*

Backend stays untouched — any missing backend capability becomes a separate `bus_api` change request.

---

## 12. Open risks

1. **pdfkit Arabic shaping** (mitigation: P0 spike + HTML fallback).
2. Backend cursor pagination has no totals — dashboard shows "more" affordance, never page counts.
3. `docs/openapi.json` drift — proxy paths must be re-checked whenever `bus_api` regenerates docs.
