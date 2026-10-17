<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Bus Platform Super-Admin Dashboard

Next.js 16 App Router (RSC-first) super-admin dashboard, Arabic-only RTL. Backend is `../bus_api` — never modify it; file API gaps/change requests in `PROGRESS.md` instead.

## Commands

```bash
pnpm install
pnpm dev     # needs .env.local: BUS_API_URL → running ../bus_api (see .env.example)
pnpm build
```

Gates, in order: `pnpm typecheck` → `pnpm lint` → `pnpm i18n:check` → `pnpm check:validation`; add `pnpm build` for anything non-trivial. Expected results: lint 0 errors (one pre-existing warning in `app/(shell)/permissions/page.tsx`), 73 validation checks.

Tests are hermetic — real modules transpiled into `vm` with mocked fetch/SDKs, no backend, cookies or browser needed:

```bash
node --experimental-strip-types --test "test/*.test.mjs"   # all 61 tests
```

Use the quoted glob: `--test test/` fails with `MODULE_NOT_FOUND` on Windows/Node 24. Named suites: `pnpm test:auth`, `test:notifications`, `test:trip-edit`, `test:driver-assignment`, `test:booking-detail`, `test:group-booking`. There is no CI — verification is these local gates plus a manual walkthrough against a live `bus_api`.

## Where truth lives

- `PROGRESS.md` — running log + gate evidence. Its "Implementation amendments" sections override `PRD.md` where they conflict (login is email-or-phone now, PDF report templates still pending, etc.); read the newest entries before touching a surface.
- `PRD.md` — requirements (referenced as PRD §N). `specs/000…004` — speckit specs; `.specify/memory/constitution.md` — principles.

## Architecture (non-obvious)

- **The owner user IS the company/tenant.** Owner-scoped routes are `/fleet-owners/{ownerId}/…` and owner-scoped calls carry `x-owner-id` (zustand `stores/filters.ts` → cookie `lib/owner-scope-cookie.ts` → header). There is no fleet level any more; `/fleets*` bookmarks 308-redirect in `next.config.ts`. Trips are nested under their line (`/trip-lines/{lineId}/trips`) and derive origin/destination from it — trip bodies never carry From/To, direction or fare.
- **BFF**: browser calls same-origin `/api/*`; catch-all `app/api/[...proxy]/route.ts` attaches the JWT, forwards to `BUS_API_URL`, unwraps `{statusCode, data}` once, maps backend codes to Arabic. Mutations are re-validated against the zod registry in `lib/schemas/p1.ts`, keyed by the **backend** pathname — a new mutation route that is not registered there passes through unvalidated. Mutations whose `Origin` ≠ `DASHBOARD_ORIGIN` are rejected (`originAllowed`).
- **Middleware is `proxy.ts` at the repo root** (Next 16 renamed `middleware.ts`); it only restores/rotates the edge session. The authoritative guard is `app/(shell)/layout.tsx` (`readSession` → live `/me` check).
- **Auth**: `POST /api/auth/login` takes `{identifier (email or phone), password, rememberMe}`. Cookies `sa_access` (~15m), `sa_refresh` (single-use, rotating), `sa_remember`; never `localStorage`. Identity (`id`, `email`, `appRole`) is decoded from the access JWT (`identityFromValidatedToken`) and validated live against `GET /me`, which also returns `platformPermissions`. Admission: `isDashboardRole` = `super_admin` or `platform_staff` (`lib/access.ts`). Page access goes through `can()`; every sidebar route must be registered in `NAV_PERMISSIONS` (`lib/nav-permissions.ts`) or it is never navigable.
- **Client data**: TanStack Query (`lib/queries.ts` — `qk`, `useApiQuery`); mutations go through `lib/actions/*` (returning `ActionResult`) with cache-impact helpers in `lib/cache/mutations.ts`; every successful mutation fires `RECORD_MUTATED_EVENT`, which invalidates all queries (`app/providers.tsx`).
- **Errors**: never render the API's English text. `lib/errors.ts` maps backend `code` → `t("errors.<CODE>")` (copy in `ar.json`); unmapped codes fall back to the API's Arabic message (`Accept-Language: ar`) or a status-based line. A bare 409 `CONFLICT` requires the calling screen to pass a `conflictKey`.
- **Lists**: cursor pagination only — `{items, nextCursor}`, `?cursor=&limit=` (default 20), no totals; `components/tables/cursor-list.tsx` layers client-side pagination over loaded pages.
- **Uploads**: `apiStageImage` signs → bytes go directly to Supabase → caller links the record and MUST call `apiDiscardStaged` on cancel/failure (`lib/actions/http.ts`).
- **Fan-out reads** use `mapWithConcurrency`: unbounded `Promise.all` exhausts the API's DB transaction pool.
- **PDFs**: only `/api/reports/spike` exists (P3 templates pending). `pdfkit` + `bidi-shaper/pdfkit` `textBidi` + Cairo embedded from `assets/fonts` (font path is basename-scoped under that dir).

## i18n (enforced)

- All user-facing Arabic lives in `lib/i18n/ar.json`; read it with `t("dotted.key")` from `@/lib/i18n/t` (isomorphic, type-checked keys, `{placeholder}` slots). Never hardcode copy in components, libs or actions.
- `pnpm i18n:check` fails on hardcoded Arabic and missing keys; its "not referenced by `t()`" notices are expected for dynamic lookups (error codes, enum labels via `tv()`).

## Repo notes

- `agents-.md` at the root is a stale duplicate of this file — ignore it. `graphify-out/`, `.zcode/`, `.next/`, `tsconfig.tsbuildinfo`, `.pricing-*.log` are generated/tool artifacts.
- `.env.example` is the env contract; its values are server-only (never add `NEXT_PUBLIC_*` secrets).
