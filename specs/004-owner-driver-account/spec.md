# 004 — Owners are drivers: one account, one roster

Implements the dashboard half of `bus_api` spec 015 (owner and driver share one
account; independent drivers stop existing).

## Problem

The dashboard still ships the retired model:

- The create-driver dialog (`components/drivers/create-driver-dialog.tsx`) has an
  INDEPENDENT vs OWNER radio (`mode`), defaulting to INDEPENDENT, and
  `POST /fleet-owners/drivers` in the API is losing that field.
- The global driver list renders `isIndependent` as "حساب مستقل"
  (`drivers.list.independentOwner`) and shows a single assigned-bus column even
  though a driver may hold several active assignments.
- Owner rows appear inside driver mutation surfaces (edit/status/delete dialogs)
  even though owner accounts are protected in the API
  (`OWNER_DRIVER_MANAGED_AS_OWNER`) — the operator only learns on submit.
- Owner creation doesn't say the account also works for driving; bus creation
  still offers an independent-driver ownership mode.

## Decision (agreed)

- The driver account model becomes: every driver row is either an employed
  driver (membership under an owner) or the owner's own self-membership
  (`isOwnerDriver`). No independent mode anywhere; creating a driver always
  requires an owner.
- Owner rows in driver surfaces are display + navigation only: status, edit,
  delete, and membership mutations route to owner administration
  (`/fleet-owners/[id]`), matching the API protections.
- Types, zod proxy schemas, action wrappers, Arabic error mappings, and cache
  invalidation change together, in one pass.

## Requirements

- **R1** Create-driver dialog: mode selector removed; owner picker required
  (searchable, from `fetchOwnerOptions`); locked to the current owner when opened
  from an owner page. Submits `{ownerId, …}` with no `mode`.
- **R2** Owner creation dialog explains (Arabic copy) that the account works for
  driving immediately and appears in the driver roster.
- **R3** Driver lists (global + owner-scoped): drop `isIndependent` labels; show an
  "مالك وسائق" badge for `isOwnerDriver` rows; show the actual owner name; show all
  active assigned bus plates (`assignedBuses`, not just `assignedBus`).
- **R4** Owner-driver rows: assignment, details, trip history, ratings, and a link
  to the owner account are offered; status/edit/delete/roster-membership actions
  are replaced by an "manage in owners screen" action linking to
  `/fleet-owners/[ownerId]`.
- **R5** Driver pickers (bus assignment dialogs, member forms) filter to eligible
  drivers only: active user, active membership, active driver-capable role, and —
  for owner-scoped flows — the selected owner's scope. Owner-driver rows appear in
  their own fleet's picker.
- **R6** Generic members section: the owner's self-membership row shows the
  protected-account state and disables edit/remove (API 409
  `OWNER_DRIVER_MANAGED_AS_OWNER` mapped to Arabic with guidance to owner admin).
- **R7** Bus creation: independent-driver ownership mode removed; every bus belongs
  to a selected owner. Preserve the driver-fixed "create bus then assign" flow,
  staged-image cleanup, and assignment-only retry after partial success.
- **R8** `lib/schemas/p1.ts`: `createDriverAccountBase` drops `mode` +
  `superRefine`, requires `ownerId`; roster schemas gain `isOwnerDriver`,
  user `isActive`, `assignedBuses`. `SystemDriverRow` and related types updated.
- **R9** `lib/errors.ts`: map `OWNER_DRIVER_MANAGED_AS_OWNER` and
  `OWNER_CANNOT_DRIVE_OTHER_FLEET` to Arabic copy.
- **R10** Cache: owner create/profile/status changes invalidate owner lists,
  driver lists/details, member views, and assignment pickers. Never merge an owner
  response into a driver row (user ids and membership ids identify different
  records); `lib/cache/mutations.ts` drops `isIndependent` usage.
- **R11** Arabic copy for all new states lives in `lib/i18n/ar.json` via `t()`
  (`pnpm i18n:check` clean); removed keys deleted, not orphaned.

## Non-goals

- No new pages; `/drivers` and `/fleet-owners` keep their routes.
- No API contract addition beyond spec 015; no pagination change.

## Acceptance

Authenticated walkthrough: create owner → appears once in their driver roster
with the owner-driver badge → their credentials noted as both login types →
assign a bus (roster action) and self-claim direction (roster shows the bus) →
second bus assignment shows both plates → employed-driver creation requires the
owner picker → owner status toggle navigates to owner admin → replacement during
a running trip shows the Arabic 409 → cache shows fresh driver data after owner
changes. Mobile RTL layout checked at 390px.

| Gate | Command |
|---|---|
| Lint | `pnpm lint` |
| Types | `pnpm typecheck` |
| i18n | `pnpm i18n:check` |
| Validation | `pnpm check:validation` |
| Build | `pnpm build` |
