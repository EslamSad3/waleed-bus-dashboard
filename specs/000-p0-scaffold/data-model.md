# Data Model: 000-p0-scaffold

**Source entities**: `spec.md` Key Entities + `openapi.json` (`LoginRequestDto`,
`LoginResponseDto`, `CurrentUserDto`, envelope `{statusCode, data}`, cursor
`{items, nextCursor}`). P0 creates NO backend tables; all models below are
frontend/session/transfer shapes.

## Session (zustand `stores/session.ts`, hydrated from `GET /auth/me` → `CurrentUserDto`)

| Field | Type | Validation / Notes |
|---|---|---|
| `id` | string (uuid) | Required; from `CurrentUserDto.id` |
| `email` | string (nullable) | Display identity; from `CurrentUserDto.email` |
| `appRole` | `'super_admin'` (gate) \| other (reject) | Gate: MUST equal `super_admin` or redirect `/login` (`app_role` claim lives inside the JWT only) |

- State transitions: `anonymous → authenticating → authenticated | failed`;
  `authenticated → refreshing (silent, single-flight) → authenticated | expired→anonymous`.
- `authVersion` bumps server-side revoke sessions (backend-owned; dashboard only
  surfaces pre-action warnings from P1 on and maps 401 → refresh → login).

## LoginForm (shared zod `lib/schemas/auth.ts`)

| Field | Type | Validation |
|---|---|---|
| `email` | string | MUST be valid email, else "اكتب بريد إلكتروني صحيح" (backend platform login resolves by lowercased email; no `loginType`) |
| `password` | string | min 8, else inline Egyptian-Arabic required/invalid message |
| `rememberMe` | boolean | Optional, default unchecked; unchecked → session refresh cookie (no Max-Age); checked → persistent refresh cookie capped at 7 days (backend window) |

- Server re-validates the same schema in `api/[...proxy]` (trust boundary);
  backend `details.fields` map back onto these fields.

## ProxyEnvelope (transfer, `lib/api.ts`)

- Backend shape (preserved): `{ statusCode: number, data: T }`.
- Proxy unwraps ONCE → client receives `T` on success.
- Failure shape (preserved then mapped): `{ statusCode, code, message, details? }`
  → `lib/errors.ts` maps `code` → PRD §9 copy (see `contracts/error-map.ar-EG.json`).
  Unknown codes → generic "حصلت مشكلة، حاول تاني".

## CursorPage (carried shape, consumed from P1)

- `{ items: T[], nextCursor: string | null }`; `nextCursor` opaque base64url, never
  decoded; default `limit=20`; UI affordance "عرض المزيد". P0 only needs the type +
  health passthrough; no list UI yet.

## SpikePdf (transfer, `lib/pdf/spike.ts`)

| Field | Value |
|---|---|
| Route | `GET /api/reports/spike` |
| Engine | pdfkit + embedded Cairo (`PDF_FONT_PATH`) + `bidi-shaper/pdfkit` `textBidi`, `direction: rtl`, `align: right` |
| Content | Arabic prose line + digits/mixed line + table header row (proves shaping + order + numerals) |
| Filename | `تقرير-spike-<YYYY-MM-DD>.pdf` |
| Verdict | `PASS` (shaped/ordered) or `FAIL` (+ HTML-fallback decision, blocks P3) |

## Relationships

- `LoginForm → POST /auth/login → (httpOnly cookies) → GET /auth/me → Session`.
- `Session.app_role` gates `(shell)`; `Session` cookies authorize `[...proxy]`.
- `ProxyEnvelope` wraps every backend op; `CursorPage` is the list specialization.
- `SpikePdf` is standalone (no session data dependency beyond auth guard).
