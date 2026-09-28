# 003 — Fleet owners and companies on one screen

Implements the dashboard half of `bus_api` spec 014.

## Problem

The dashboard shipped two independent CRUD surfaces for one data tree:

- `/fleets` — a flat list of every fleet. The API returned only `ownerId`, so the
  page fanned out to `GET /users?limit=100` to turn ids into names, and showed
  `ownerName` as just another column.
- `/fleets/[id]` — a detail page with six tabs, reachable only by id.
- `/fleet-owners` + `/fleet-owners/[id]` — the owners, with each owner's companies
  listed as plain links back into `/fleets/{id}`.

Every fleet has exactly one owner (required FK), so the operator had to keep two
screens in sync by hand, and the company list could not show who owned what
without cross-referencing.

## Decision (agreed)

- One menu entry, one screen: `/fleet-owners` and `/fleet-owners/[id]`.
- The six fleet sections are rendered **inline** inside the owner page rather than
  behind a per-company route. There is no `/fleet-owners/[id]/companies/[companyId]`
  segment and no deep link per company.
- `/fleets` and `/fleets/[id]` are deleted; `next.config.ts` redirects
  `/fleets` → `/fleet-owners` and `/fleets/:id` → `/fleet-owners?fleet=:id`, and
  the page expands that company on load. Deep linking survives the redirect even
  though the route does not.

## Requirements

- **R1** The sidebar has one entry. `common.nav.fleets` and the duplicate home
  module card are gone.
- **R2** The owner list shows each owner's companies inline (count via the
  Egyptian plural helper + names), and search still matches company names.
- **R3** `/fleet-owners/[id]` has *Account* and *Companies* tabs. The Companies tab
  lists the owner's companies; expanding one shows its summary (name, status, VIP
  tier, add owner) and the Buses/Members/Trips/Bookings/Reports sections.
- **R4** At most one company is open at a time, and **opening a company is what sets
  the fleet scope** (`useFilterStore.setFleetId` + `setFleetScopeCookie`). This
  replaces the mount effect in the deleted `/fleets/[id]` page and is required by
  the `/fleet/*` calls the sections make (reports, disable/reactivate bus, assign
  driver, assign trip line) — those are the only fleet calls that need the header.
- **R5** Create company (`AddFleetToOwnerDialog`) is shared by the list row action
  and the detail screen; the old standalone "create fleet + pick owner" dialog is
  gone because the owner is always known now.
- **R6** Delete company moved to the expanded company row, with the same confirm and
  409 copy; delete owner stays on the list.
- **R7** The zod registry in `lib/schemas/p1.ts` is keyed on the **backend** path, and
  the BFF proxy silently accepts unmatched paths — so all 10 fleet patterns move with
  the API. A missed pattern would drop client-side validation with no error.
- **R8** `fleets.*` dictionary keys fold into `fleetOwners.fleets.*` (entity-scoped,
  mirroring the API's `fleet-owners.fleets.*` permission family). Keys are
  type-checked, so `tsc` finds every call site.

## Non-goals

- No server component is introduced: the screen is a client page like every other
  list screen in the app.
- The buses/trips/bookings **global** screens keep their fleet pickers; the merge is
  about administering companies, not about removing fleet scoping elsewhere.
- The session still carries only `appRole`, so the single menu entry stays ungated
  (as both entries were before). A role holding `fleet-owners.read` but not
  `fleet-owners.fleets.read` sees the list and gets the API's 403 on company
  content, mapped to Arabic by `lib/errors.ts`.

## Verification

`pnpm lint` · `pnpm typecheck` · `pnpm i18n:check` · `pnpm build`, plus a browser
smoke test of `/login` and the owner screen copy.
