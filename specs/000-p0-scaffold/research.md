# Research: 000-p0-scaffold

**Date**: 2026-09-11 | **Spec**: `specs/000-p0-scaffold/spec.md`
All NEEDS CLARIFICATION from Technical Context resolved below.

## R1. pdfkit Arabic shaping + BiDi (blocking spike)

- **Decision**: pdfkit (latest) + embedded Cairo TTF + `bidi-shaper` (`bidi-shaper/pdfkit`
  `textBidi` adapter), base paragraph direction `rtl`, `align: right`.
- **Rationale**: pdfkit's engine (fontkit) already performs Arabic contextual shaping
  (initial/medial/final forms, lam-alef via OpenType GSUB) but performs NO Unicode
  Bidirectional Algorithm reordering (foliojs/pdfkit#219, open since 2014; an RTL `direction`
  PR exists but is unmerged). Feeding logical-order Arabic directly renders reversed
  word order. `bidi-shaper` (MIT, zero-dep, ~15 kB, verified against 861,948 UAX #9
  conformance cases) runs shaping + UAX #9 reorder + mirroring and its pdfkit adapter
  passes `features: []` so fontkit does not double-shape — exactly the trap of naive
  reshaper+pdfkit combos. Cairo contains Arabic Presentation Forms-A/B glyphs.
- **Alternatives considered**:
  - `arabic-reshaper` / `arabic-persian-reshaper`: same PFB-substitution idea but
    GPL / unmaintained (2017/2020) — rejected on license + maintenance.
  - `bidi-js` alone: reorder only, no shaping (acceptable since fontkit shapes, but
    then we own the double-shaping guard ourselves) — fallback if `bidi-shaper`
    adapter misbehaves.
  - `rtl-pdf` (pdfkit+fontkit+bidi-js wrapper with `/ActualText`): correct
    architecture but v0.1.x, no tables/forms, single-font limits — rejected for v1.
  - Headless-HTML (Chromium) render with `dir=rtl`: browsers implement BiDi+shaping
    perfectly — adopted as the **documented fallback** if the spike FAILs (cost:
    heavy runtime; only if spike proves pdfkit insufficient).
  - HarfBuzz WASM (`harfbuzzjs`, ~3.3 MB / ~1 MB variants): typographically best but
    heavyweight for a one-page proof — deferred unless spike FAILs.
- **Spike procedure**: `GET /api/reports/spike` → register Cairo from `PDF_FONT_PATH`,
  `textBidi(doc, 'تقرير تجريبي — مرحبا بالعالم 123', { align:'right' })` + table header
  + digits line → assert visual join/order by opening PDF; record PASS/FAIL in gate.

## R2. Next.js proxy + httpOnly session + guard pattern

- **Decision**: App Router Route Handler `app/api/[...proxy]/route.ts` as Backend-for-Frontend
  (clone request → zod-validate → attach `Authorization: Bearer <access>` from httpOnly
  cookie → `fetch(BUS_API_URL + pathname+search)` → unwrap `{statusCode, data}` → map
  `code` via `lib/errors.ts` → `NextResponse`), cookies via `next/headers` `cookies()`
  get/set/delete; optimistic guard in `proxy.ts` (Next.js 16 convention; matcher excludes
  `api|_next|static|images`) + authoritative check in `(shell)/layout.tsx` via
  `GET /auth/me` → zustand session.
- **Rationale**: Matches official Next.js BFF + auth-proxy guidance (Context7
  `/vercel/next.js`: "Proxying Requests with Route Handlers", "optimistic route
  protection in Proxy", "Read and Set Cookies with next/headers"). Optimistic
  cookie-presence redirect keeps prefetches fast; layout re-verifies role so forged
  cookies never pass. Single-flight refresh (in-memory promise) avoids stampedes.
- **Alternatives considered**:
  - Direct browser → `BUS_API_URL` with in-memory token: rejected — violates
    Principle II (tokens in JS, CORS/secret exposure).
  - NextAuth/Auth.js session: rejected — backend owns HS256 JWT + `authVersion`
    rotation; duplicating session infra drifts from `openapi.json`.
- **Refresh semantics** (from `openapi.json`): `POST /auth/refresh` rotates refresh
  token and mints new pair; body `{statusCode, data: LoginResponseDto}`; on 401 clear
  both cookies → client 401 → `/login`. `POST /auth/logout` revokes + `data: null`.

## R3. Fonts, RTL, shadcn + Tailwind theme

- **Decision**: `next/font/google` Cairo (variable, 200–1000) + Poppins (100–900);
  `<html lang="ar" dir="rtl">`; Tailwind theme vars `--primary:#2f719e`,
  `--secondary:#daeaf5`, `--accent:#fff7e3`, `--foreground:#1a1a1a`,
  `--muted-foreground:#606060`, `--radius:1rem`; shadcn `new-york` + `lucide-react`;
  page gradient `linear-gradient(270deg,#e8e8ec,#e9efff,#fff)`; dark bg `#000557`
  reserved (P4 wires the toggle).
- **Rationale**: Direct transcription of PRD §3 (arrw.com clone); `next/font`
  self-hosts with zero CLS. Western digits in tables per PRD §10.
- **Alternatives considered**: manual `@font-face` with local TTF — rejected (worse
  caching/subsetting than `next/font`); full dark-mode in P0 — rejected (P4 scope).

## R4. Forms + validation + state + data-fetching

- **Decision**: react-hook-form + `ui/form` + zod + `@hookform/resolvers/zod`;
  schemas in `lib/schemas/` imported by BOTH client form and route handler (trust
  boundary re-validation; server `details.fields` mapped back to fields);
  zustand `stores/session.ts` (`{id,name,app_role}`) + `stores/filters.ts`
  (fleet-scope persisted to cookie → `x-fleet-id` header on tenant calls);
  reads in Server Components via `lib/api.ts` (`cache:no-store`), mutations via
  Server Actions → `/api/*`.
- **Rationale**: PRD §4/§5 locked stack; shared-schema pattern satisfies Principle V.
- **Alternatives considered**: TanStack Query client fetching — rejected for P0
  (RSC-first per constitution; can revisit for P1 list UX if needed).

## R5. Charts in P0 (deferred)

- **Decision**: apexcharts + react-apexcharts NOT installed in P0; overview page ships
  static KPI/CTA skeleton with empty states; charts arrive in P2 with
  `next/dynamic ssr:false` + skeletons.
- **Rationale**: Keeps P0 gate tight (login/proxy/spike); avoids client-only chart
  weight before shell exists. No clarification remains.

## R6. Env + quality gates

- **Decision**: `BUS_API_URL` (server-only), `SESSION_COOKIE_SECRET`,
  `PDF_FONT_PATH` (Cairo TTF), `NEXT_PUBLIC_APP_NAME`; `.env.example` contract,
  `.env*` gitignored. Gates: `tsc --noEmit` + eslint + manual walkthrough vs local
  `bus_api` (seeded super_admin). pnpm only, Node 24.
- **Rationale**: Mirrors constitution Technology Constraints; prevents secret leakage
  into client bundle (verified by bundle search in quickstart).
