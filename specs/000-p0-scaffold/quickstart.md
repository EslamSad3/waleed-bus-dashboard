# Quickstart: verify P0 (000-p0-scaffold)

**Prereqs**: Node 24, pnpm; `bus_api` running locally (`BUS_API_URL`, default
`http://localhost:3000`) with seeded super_admin; Cairo TTF path in `PDF_FONT_PATH`.

## 1. Configure

```bash
cd bus_dashboard
cp .env.example .env.local   # set BUS_API_URL, SESSION_COOKIE_SECRET, PDF_FONT_PATH
pnpm install
```

## 2. Run + typecheck + lint

```bash
pnpm dev                 # dashboard (own port; never :3000)
pnpm exec tsc --noEmit
pnpm lint
```

## 3. Gate walkthrough (report PASS/FAIL per item)

1. Open `/login` → submit super_admin email + password → expect
   redirect `/`, no token in DevTools Application/Storage, cookies httpOnly
   (`Secure`, `SameSite=Lax`).
2. Wrong password / non-super_admin → "بيانات الدخول غير صحيحة", stays on `/login`.
3. `GET /api/health` → backend `{status:'ok'}`; search client bundle for
   `BUS_API_URL`/JWT — MUST be absent.
4. Expire access (or delete access cookie, keep refresh) → revisit `/api/health`
   → recovers silently once (single-flight refresh); kill refresh too → 401 →
   `/login`, cookies cleared.
5. Logout → cookies cleared → `(shell)` URL redirects `/login`.
6. `GET /api/reports/spike` → open PDF → Arabic joined + RTL order + digits
   correct → record **spike PASS/FAIL** (+ HTML fallback decision if FAIL).
7. RTL/visual: `<html lang="ar" dir="rtl">`, Cairo/Poppins, gradient headline +
   tinted cards + navy band render; `loading.tsx` skeleton on slow nav.

## 4. Record

Append results to `PROGRESS.md` (P0 gate table) before starting P1.
Any missing backend capability → file a `bus_api` change request (never patch
around it, never edit `bus_api` from this repo).
