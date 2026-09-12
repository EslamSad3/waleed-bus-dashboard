# Research: 001-platform-crud

**Date**: 2026-09-11 | **Spec**: `specs/001-platform-crud/spec.md`
No NEEDS CLARIFICATION remained in Technical Context after contract + source grounding (all resolved below via `openapi.json` reads and read-only `bus_api/src` greps; backend untouched).

## R1. Path strategy — platform-first with tenant-only actions (clarified Q1)

- **Decision**: Platform `/fleets/*` for every list/detail/create/edit/delete; tenant `/fleet/*` + `x-fleet-id` header only where the backend offers no platform equivalent: bus disable/reactivate (`POST /fleet/buses/{busId}/disable|reactivate`), driver assign/unassign (`POST|DELETE /fleet/buses/{busId}/driver`), per-bus trips (`GET /fleet/buses/{busId}/trips`), driver roster (`/fleet/drivers*`).
- **Rationale**: `openapi.json` (57 paths) confirms: full CRUD exists under `/fleets/{fleetId}/buses|trips|bookings` + `/members`, while lifecycle actions exist ONLY on the tenant path. As super_admin on the platform path RLS is bypassed by design (PRD §1), so no header is needed for CRUD; `busFetch` (`lib/api.ts`) already accepts an optional `fleetId` → `x-fleet-id` for the tenant calls.
- **Alternatives considered**:
  - Tenant-everywhere + global fleet-scope selector (PRD §6.4–§6.5 literal): rejected — forces fleet pre-selection before even listing fleets' buses and duplicates list logic per path; kept only where mandatory.
  - Platform-everywhere: impossible — disable/reactivate/assign/per-bus-trips have no platform equivalent (would need a `bus_api` change request; out of P1 scope).

## R2. Per-resource validation — extend the generic proxy, don't fork it

- **Decision**: Keep the single `app/api/[...proxy]` forwarder from P0; add a zod schema registry in `lib/schemas/p1.ts` keyed by method + path pattern (e.g. `POST /fleets/:fleetId/buses`), applied inside the proxy route before forwarding. P0 clarification ("P1 adds only per-resource zod schemas") already mandates this.
- **Rationale**: One trust boundary, one refresh/cookie/error path; per-resource schemas mirror the DTO constraints from `openapi.json` (lengths, capacity 1–300, uuid formats, enums).
- **Alternatives considered**: Dedicated route handler per resource — rejected (duplicates auth/refresh/envelope logic across ~20 handlers; violates Principle VII simplicity).

## R3. Error-code mapping — explicit codes + context-aware bare `CONFLICT`

- **Decision**: Extend `lib/errors.ts` / `error-map.ar-EG.json` with new code keys (see `contracts/error-map-additions.ar-EG.json`); for bare-409 `CONFLICT` (no explicit code) the CALLING SCREEN supplies the message by context (option, defaulting to the generic conflict copy). Never sniff English backend messages.
- **Rationale** (verified in `bus_api/src`, read-only):
  - `translatePrismaError` (`src/common/prisma-error.util.ts`): P2002 (duplicate registration/member) and P2003 (fleet delete while referenced) → Nest `ConflictException` with NO explicit code → exception filter falls back to `code: 'CONFLICT'` (`defaultCodeFor`, `all-exceptions.filter.ts:84-85`). So duplicate-registration, referenced-fleet, and duplicate-member 409s are indistinguishable by code — only screen context disambiguates.
  - Explicit codes keep working: `BUS_ACTION_NOT_ALLOWED` (disable/reactivate incl. already-in-state), `DRIVER_ASSIGNMENT_NOT_ALLOWED`, `RESOURCE_NOT_OWNED` (cross-fleet 404), `VALIDATION_FAILED` (400/422).
  - Tenant 404s also use `BUS_ACCESS_DENIED` (bus-lifecycle, driver-assignment) and generic `NOT_FOUND` (P2025) — all map to "العنصر مش موجود في الأسطول ده".
  - Class-validator failures arrive as 400 with NO code → fallback `BAD_REQUEST` (must be mapped, currently missing).
  - 429 backend code is `RATE_LIMITED`, but the P0 map only has `RATE_LIMITED_429` (dead key — P1 must add `RATE_LIMITED`; `lib/api.ts` synthesizes `RATE_LIMITED_429` on status-only 429s, keep both keys).
- **Alternatives considered**: Message-text sniffing (`/already exists/`) — rejected (fragile, English-coupled, violates Principle III spirit); backend code additions — rejected (backend untouched; change request out of P1 scope).

## R4. List filtering — client-side over loaded cursor pages

- **Decision**: List endpoints document only `cursor` + `limit` query params (verified across all 10 P1 list ops in `openapi.json`); therefore search/filter UI (name, status, dates, phone) applies over loaded cursor pages, and load-more extends the pool. Server-side filter support is a future `bus_api` change request, never silently assumed.
- **Rationale**: Matches the spec assumption; avoids sending params the backend ignores (which would fake precision). Cursor (`nextCursor` opaque, default `limit=20`) still drives pagination exactly per Principle III.
- **Alternatives considered**: Passing undocumented query params hoping the backend honors them — rejected (contract infidelity; silent no-op filters).

## R5. Cancel semantics + no hidden state machines

- **Decision**: Trip cancel = `PATCH /fleets/{fleetId}/trips/{id}` `{status:'CANCELLED'}`; trip delete = `DELETE` + confirm; booking cancel = `PATCH` `{status:'CANCELLED'}` + confirm; booking delete = `DELETE` + confirm. Status editor offers all four trip statuses (no client-side transition matrix).
- **Rationale**: Backend has NO trip-status transition guards (verified: `TRIP_STATUSES` const only, no state-machine in trip services) — any status PATCH is accepted; backend errors surface in Arabic. Cancel-via-PATCH preserves history; DELETE is explicit and confirmed.
- **Alternatives considered**: Client-side forward-only transition matrix (SCHEDULED→DEPARTED→COMPLETED) — rejected (invents backend rules; backend accepts any transition).

## R6. Fleet-scope selector plumbing (already half-built in P0)

- **Decision**: `stores/filters.ts` `fleetId` (already exists) + persisted cookie; fleet picker UI (populated from `GET /fleets`) lives in the shell (sidebar/topbar); tenant-path calls read the cookie server-side and pass `fleetId` into `busFetch`; platform-path screens use the fleet id from the URL (`/fleets/[id]/...` nested or `?fleetId=`).
- **Rationale**: Reuses P0 store + `busFetch` header support; zero new session infra. Missing-scope on tenant calls surfaces the existing `MISSING_FLEET_SCOPE` ("اختار الأسطول الأول") message.
- **Alternatives considered**: URL-only fleet scope (no store/cookie) — rejected (loses scope across visits; PRD §6.4 mandates persistence).

## R7. Pickers reuse read endpoints (no new backend reads needed)

- **Decision**: Fleet-create owner picker → `GET /users` (search, read-only use; full user admin stays P2). Member role picker → `GET /roles` (slug list). Trip-create bus picker → fleet's buses list. Booking-create trip picker → fleet's trips list.
- **Rationale**: All endpoints exist in the contract; read-only reuse doesn't expand P1 scope into P2 governance.
- **Alternatives considered**: Free-text uuid inputs — rejected (unusable, error-prone); skipping pickers — rejected (required by FR-002/FR-014/FR-017).
