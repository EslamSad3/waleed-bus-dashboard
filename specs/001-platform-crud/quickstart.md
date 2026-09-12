# Quickstart: verify P1 (001-platform-crud)

**Prereqs**: P0 gate PASS; `bus_api` running locally with seeded super_admin
(+ at least one fleet with bus/trip/booking/member data, or create it live
during the walkthrough); dashboard on its own port.

## 1. Run + typecheck + lint

```bash
cd bus_dashboard
pnpm dev                 # dashboard (own port; never :3000)
pnpm exec tsc --noEmit
pnpm lint
```

## 2. Gate walkthrough (report PASS/FAIL per item; zero raw backend codes visible)

**Fleets** (`/fleets`): list loads with search + active filter + load-more →
create (name + owner picker) → detail tabs render → rename + deactivate →
delete empty fleet (confirm) → delete referenced fleet → Arabic 409 guard,
fleet kept.

**Buses** (`/buses`, fleet scope selected): list → register → duplicate
registration → "رقم التسجيل مستخدم قبل كده" → edit plate/capacity →
disable → disable during DEPARTED → Arabic 409 → reactivate → assign
driver → re-assign same (success, no duplicate) → unassign → per-bus trips
tab lists trips.

**Trips** (`/trips`): status/route/date filters → create with same-fleet bus →
create with cross-fleet bus → "العنصر مش موجود في الأسطول ده" → detail
timeline → SCHEDULED→DEPARTED→COMPLETED → cancel another (PATCH) → delete
with confirm.

**Bookings** (`/bookings`): trip/status/payment filters + passenger search →
create (missing name → "الحقل ده مطلوب") → detail timeline + ratings →
edit → cancel with confirm → delete with confirm.

**Members + roster** (fleet Members tab + `/drivers`): add existing user →
duplicate → Arabic conflict → suspend with warning + confirm → remove with
confirm → invite driver with fresh credentials → appears ACTIVE → driver
detail shows assignment history → cross-fleet id → Arabic 404.

**Shared**: `tsc --noEmit` + eslint clean; no `BUS_API_URL`/tokens in client
bundle; every mutation toast names the action; anonymous access still
redirects to `/login`.

## 3. Record

Append results to `PROGRESS.md` (P1 gate row) before starting P2.
Any missing backend capability → file a `bus_api` change request (never patch
around it, never edit `bus_api` from this repo).
