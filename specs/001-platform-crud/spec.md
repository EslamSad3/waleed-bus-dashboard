# Feature Specification: P1 Platform CRUD — fleets, buses, trips, bookings, members

**Feature Branch**: `001-platform-crud`

**Created**: 2026-09-11

**Status**: Draft

**Input**: PRD `D:/Eslam/waleed/bus/bus_dashboard/PRD.md` §§1–2, 5–6, 8–12 (P1 scope only).
Backend contract: `D:/Eslam/waleed/bus/bus_api/docs/openapi.json` (57 paths). Backend MUST NOT be modified.
Depends on P0 (gate PASS): login, generic `/api/[...proxy]` forwarder, session/guard, error map, copy deck.

## Clarifications

### Session 2026-09-11

- Q: Platform path, tenant path, or mixed for fleet-scoped screens (PRD §6.4–§6.5 mix both)? → A: **Platform-first** — platform `/fleets/{fleetId}/*` for all list/detail/create/edit/delete; tenant `/fleet/*` + `x-fleet-id` (from the fleet-scope selector) only where the backend offers no platform equivalent: bus disable/reactivate, driver assign/unassign, per-bus trips, driver roster.
- Q: P1 "members" = fleet-detail Members tab only, or also the `/drivers` roster? → A: **Include the drivers roster** — fleet Members tab (existing-user invite, role/status change, remove) plus `/drivers` roster (users list, invite by existing user or fresh phone+name+password via `POST /fleet/drivers`, role/status change with warning, assignment history per driver).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Fleet management (Priority: P1)

The operator opens `/fleets` and sees a cursor-paged fleet list with name search,
active/inactive filter, and an "عرض المزيد" load-more button (no page counts —
backend pagination has no totals). From there they create a fleet (name, owner
picked from existing users, optional initial owner role), open a fleet detail
page with tabs (Overview · Buses · Trips · Members · Bookings · Reports), rename
it, activate/deactivate it, or delete it. Deleting a fleet that still has
buses/trips/bookings fails with the Arabic guard message instead of deleting.

**Why this priority**: Every other P1 module nests under a fleet; without fleet
CRUD nothing else is reachable.

**Independent Test**: Against locally running `bus_api`: create → appears in
list; rename → persists; deactivate → filtered out by active filter; delete
empty fleet → gone; delete referenced fleet → Arabic 409 message, fleet kept.

**Acceptance Scenarios**:

1. **Given** authenticated super_admin at `/fleets`, **When** the list loads, **Then** fleets show name + status + dates with search, active filter, and load-more working.
2. **Given** `/fleets/new`, **When** submitting name + owner (valid user), **Then** the fleet is created and the operator lands on its detail page.
3. **Given** a fleet detail page, **When** renaming or toggling active, **Then** the change persists and a confirmation toast shows.
4. **Given** a fleet with buses/trips/bookings, **When** deleting it, **Then** the Arabic 409 guard message shows and the fleet is kept.

---

### User Story 2 — Bus management + per-bus trips (Priority: P1)

The operator picks a working fleet (fleet-scope selector, remembered across
visits), then at `/buses` sees that fleet's buses with a per-fleet-unique
registration number, plate, capacity, and status. They register a new bus
(duplicate registration in the same fleet → "رقم التسجيل مستخدم قبل كده"),
edit plate/capacity, disable or reactivate it — disabling a bus with a running
(DEPARTED) trip fails with "العملية مرفوضة: الأتوبيس عليه رحلة شغالة
(DEPARTED)" — and assign/unassign a driver (re-assigning the same driver
reports success idempotently; assigning an inactive or foreign driver fails
with the Arabic driver message). The bus detail page has a trips tab listing
that bus's trips. Path strategy (clarified): platform `/fleets/{fleetId}/buses*`
for list/detail/create/edit/delete; tenant `/fleet/buses/{busId}/*` (fleet-scope
header) only for disable/reactivate/assign/unassign/per-bus-trips.

**Why this priority**: Buses are the core operational asset; trips and bookings
both hang off buses.

**Independent Test**: Per fleet: create bus → duplicate registration rejected in
Arabic → edit plate → disable → disable-during-DEPARTED rejected in Arabic →
reactivate → assign driver → unassign → per-bus trips tab lists trips.

**Acceptance Scenarios**:

1. **Given** a selected fleet at `/buses`, **When** registering a bus with a registration number already used in that fleet, **Then** "رقم التسجيل مستخدم قبل كده" shows and nothing is created.
2. **Given** a bus with a DEPARTED trip, **When** disabling it, **Then** the Arabic 409 message shows and the bus stays active.
3. **Given** a bus detail page, **When** opening the trips tab, **Then** that bus's trips list (cursor-paged) shows.
4. **Given** a bus with an assigned driver, **When** assigning the same driver again, **Then** success is reported without duplicating the assignment.

---

### User Story 3 — Trip management (Priority: P2)

The operator at `/trips` sees trips (filterable by status, origin/destination
search, date range) for the working fleet, creates a trip (bus from the same
fleet, origin, destination, departure time — a bus from another fleet resolves
to "العنصر مش موجود في الأسطول ده"), opens trip detail (route, bus, schedule,
status timeline, link to the bookings manifest), edits route/timing, moves
status (SCHEDULED → DEPARTED → COMPLETED, or CANCELLED), or deletes the trip
with explicit confirmation.

**Why this priority**: Trips connect buses to bookings; needed before the
bookings manifest is meaningful.

**Independent Test**: Create trip → appears filtered by status → edit timing →
move SCHEDULED→DEPARTED→COMPLETED → cancel another trip → delete a SCHEDULED
trip with confirm → cross-fleet bus id rejected with the Arabic 404 message.

**Acceptance Scenarios**:

1. **Given** `/trips/new` with a working fleet, **When** creating a trip with a bus from another fleet, **Then** "العنصر مش موجود في الأسطول ده" shows.
2. **Given** a SCHEDULED trip, **When** moving it to DEPARTED then COMPLETED, **Then** each transition persists and shows in the timeline.
3. **Given** a trip detail page, **When** deleting, **Then** an explicit confirmation precedes deletion and the operator returns to the list.

---

### User Story 4 — Booking management (Priority: P2)

The operator at `/bookings` sees the working fleet's bookings filterable by
trip/status/payment with passenger name/phone search, creates a booking for a
trip in the same fleet (passenger name required, phone optional), opens booking
detail (passenger, trip link, status/payment timeline, per-side ratings when
present), edits passenger data, or cancels the booking (status → CANCELLED)
with explicit confirmation. A booking for a cross-fleet trip resolves to
"العنصر مش موجود في الأسطول ده".

**Why this priority**: Bookings are the passenger-facing record and the input
to P3 manifests/settlements; full CRUD is required by the P1 gate.

**Independent Test**: Create booking for a fleet trip → appears in list →
search by passenger phone finds it → edit name → cancel with confirm →
cross-fleet trip id rejected with the Arabic 404 message.

**Acceptance Scenarios**:

1. **Given** `/bookings/new`, **When** submitting without a passenger name, **Then** "الحقل ده مطلوب" shows on the field.
2. **Given** a CONFIRMED booking, **When** cancelling, **Then** confirmation precedes it and status becomes CANCELLED.
3. **Given** the bookings list, **When** searching by passenger phone, **Then** matching bookings show with Western digits.

---

### User Story 5 — Fleet membership + drivers roster (Priority: P2)

From the fleet detail Members tab the operator sees memberships (user, role,
status, joined date), adds an existing active user with a role (duplicate →
Arabic conflict message), changes a member's role/status, or removes the
membership. Changing to SUSPENDED/REVOKED or removing shows the pre-action
warning ("هيقفل جلسات السواق" / sessions revoked immediately) and requires
explicit confirmation. Additionally the `/drivers` roster (clarified scope)
shows fleet drivers with search, verified/active filters, and per-driver
assignment history (ACTIVE/ENDED rows); the operator invites a driver either
from an existing user or with fresh phone+name+password, changes driver
role/status with the same pre-action warning, or removes the driver (ends
membership + active assignment) with confirmation.

**Why this priority**: Roster changes are security-sensitive (session
revocation) and gate driver assignment; must be explicit and warned.

**Independent Test**: Add existing user → duplicate add rejected in Arabic →
suspend with warning → sessions revoked → remove with confirm → membership
gone; invite driver with fresh credentials → appears in roster with ACTIVE
membership; cross-fleet member id → Arabic 404 message.

**Acceptance Scenarios**:

1. **Given** the Members tab, **When** adding a user already in the fleet, **Then** the Arabic conflict message shows.
2. **Given** an ACTIVE member, **When** suspending, **Then** the pre-action warning shows, confirmation is required, and the status persists.
3. **Given** a member row, **When** removing, **Then** confirmation precedes removal and the row disappears.
4. **Given** the `/drivers` roster, **When** inviting with fresh phone+name+password, **Then** the driver appears with an ACTIVE membership and assignment history is empty.

---

### Edge Cases

- Backend list endpoints expose only `cursor` + `limit` (no server-side search/filter params): list search/filter UI applies over loaded cursor pages unless the backend gains filter support (filed as a `bus_api` change request, never worked around client-side silently — the spec states where filtering is client-side).
- Cross-fleet ids always resolve to 404 ("العنصر مش موجود في الأسطول ده"), never 403 — UI must not reinterpret 404 as "no permission".
- Empty modules render the P0 empty-state pattern (message + primary action), never a blank table.
- Destructive actions (delete fleet/bus/trip/booking, remove member, suspend/revoke) always require explicit confirmation; roster changes additionally show the session-revocation warning.
- Concurrent edit conflicts surface the backend 409 message ("البيانات متعارضة مع سجل موجود (راجع الحقول)") without losing the operator's input.
- Session expiry mid-flow follows the P0 refresh/redirect behavior (no per-screen re-implementation).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST list fleets cursor-paged (`GET /fleets`, default `limit=20`) with name search, active filter, and "عرض المزيد" load-more; never page counts.
- **FR-002**: System MUST create fleets (`POST /fleets`: name 1–255, `ownerId` uuid required, optional `ownerRoleSlug`) with the owner picked from existing users.
- **FR-003**: System MUST show fleet detail (`GET /fleets/{id}`) with tabs Overview · Buses · Trips · Members · Bookings · Reports (Reports tab links forward to P3 scope).
- **FR-004**: System MUST edit fleets (`PATCH /fleets/{id}`: name, `isActive`) and surface 404 via the Arabic fleet message.
- **FR-005**: System MUST delete fleets (`DELETE /fleets/{id}`) only with explicit confirmation; 409 (still referenced) shows the Arabic guard message and keeps the fleet.
- **FR-006**: System MUST keep a fleet-scope selector (persisted across visits) that drives every fleet-scoped screen and is sent as `x-fleet-id` on tenant-path calls.
- **FR-007**: System MUST list buses per fleet (cursor-paged) and show bus detail (registration, plate, capacity, status, assignment history where available).
- **FR-008**: System MUST register buses (registrationNumber required unique-per-fleet, capacity 1–300; plate optional) and map duplicate registration to "رقم التسجيل مستخدم قبل كده".
- **FR-009**: System MUST edit buses (plate/capacity/active) and map duplicate registration on edit to the same Arabic message.
- **FR-010**: System MUST disable/reactivate buses; disable blocked by a DEPARTED trip maps 409 `BUS_ACTION_NOT_ALLOWED` to "العملية مرفوضة: الأتوبيس عليه رحلة شغالة (DEPARTED)".
- **FR-011**: System MUST assign/unassign drivers per bus (idempotent messaging on re-assign; 409 `DRIVER_ASSIGNMENT_NOT_ALLOWED` maps to "تعيين السواق مرفوض: مش نشط أو من أسطول تاني").
- **FR-012**: System MUST show a per-bus trips tab (cursor-paged).
- **FR-013**: System MUST list trips per fleet (cursor-paged) with status filter, origin/destination search, and date-range filter.
- **FR-014**: System MUST create trips (bus from same fleet required; origin/destination 1–255; `departAt` date-time; status defaults SCHEDULED) and map cross-fleet bus ids to "العنصر مش موجود في الأسطول ده".
- **FR-015**: System MUST show trip detail (route, bus link, schedule, status timeline, bookings-manifest link) and support status transitions + edit + delete-with-confirmation.
- **FR-016**: System MUST list bookings per fleet (cursor-paged) with trip/status/payment filter and passenger name/phone search.
- **FR-017**: System MUST create bookings (trip from same fleet required; passengerName required; phone optional) and map cross-fleet trip ids to the Arabic 404 message.
- **FR-018**: System MUST show booking detail (passenger, trip link, status/payment timeline, ratings 1–5 per side when present) and support edit + cancel-with-confirmation.
- **FR-019**: System MUST list fleet members per fleet (cursor-paged: user, role, status, joined date).
- **FR-020**: System MUST add members (existing active user + role; duplicate maps to the Arabic conflict message) and change role/status or remove membership only after the session-revocation warning + explicit confirmation.
- **FR-021**: System MUST mirror backend shapes exactly: `{statusCode, data}` envelope unwrapped once, `{items, nextCursor}` pages passed through, opaque `nextCursor` never decoded.
- **FR-022**: System MUST extend the P0 Egyptian-Arabic error map (PRD §9 + `CONFLICTING_ASSIGNMENT` + fleet/member messages) and validate every mutation input with zod in the route handler as well as the form.
- **FR-023**: System MUST keep every P1 screen behind the existing super_admin guard; every mutation shows a toast naming the audited action.
- **FR-024**: System MUST use Western digits inside tables with Arabic labels, per the P0 copy deck (extend `specs/dashboard/copy-ar-EG.md` with P1 strings).
- **FR-025**: System MUST show the `/drivers` roster per working fleet (tenant `GET /fleet/drivers`, cursor-paged) with search and verified/active filters.
- **FR-026**: System MUST invite drivers tenant-side (`POST /fleet/drivers`) from an existing user id OR fresh phone+name+password (min 8), defaulting to the driver role; duplicate/inactive targets map to Arabic messages.
- **FR-027**: System MUST show per-driver detail (membership, assignment history ACTIVE/ENDED) and support driver role/status change (with session-revocation warning) and removal (ends membership + active assignment) with confirmation.

### Key Entities

- **Fleet**: `{id, name, ownerId, isActive, createdAt, updatedAt}`; root scope for all P1 modules.
- **Bus**: `{id, fleetId, registrationNumber (unique per fleet), plateNumber?, capacity 1–300, isActive, timestamps}`; has driver assignment (ACTIVE/ENDED rows, history kept).
- **Trip**: `{id, fleetId, busId, origin, destination, departAt, status: SCHEDULED|DEPARTED|COMPLETED|CANCELLED, timestamps}`.
- **Booking**: `{id, fleetId, tripId, passengerName, passengerPhone?, seats ≥ 1, status: CONFIRMED|CANCELLED, timestamps}`; carries per-side ratings when present.
- **FleetMember**: `{id, userId, fleetId, roleId, status: ACTIVE|SUSPENDED|REVOKED, joinedAt}`; suspend/revoke/remove invalidates the target's sessions immediately.
- **Driver (roster view)**: fleet driver invited via existing user or fresh credentials; carries membership + assignment history (ACTIVE/ENDED rows).
- **Cursor page**: `{items[], nextCursor: string|null}` — opaque cursor, no totals.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operator completes a full create→read→update→delete walkthrough for each of fleets, buses, trips, bookings, members, and the drivers roster against the local backend with zero raw backend codes visible.
- **SC-002**: Every triggered 409/404 (duplicate registration, referenced fleet, DEPARTED-blocked disable, foreign driver, cross-fleet id) displays its Egyptian-Arabic message within the acting screen.
- **SC-003**: All five list screens load-more through at least 2 cursor pages where data exists, and none displays page counts or totals.
- **SC-004**: 100% of destructive or session-revoking actions (delete, suspend/revoke, remove, unassign) require explicit confirmation, with the revocation warning shown on roster changes.
- **SC-005**: P1 gate walkthrough passes: full CRUD per module with the Arabic 409/404 messages verified, `tsc --noEmit` + eslint clean.

## Assumptions

- Operator is an authenticated `super_admin` (P0 guard reused, no per-screen re-implementation).
- Super_admin uses the backend **platform path** (`/fleets/*`, RLS bypassed by design, PRD §1); tenant path (`/fleet/*` + `x-fleet-id`) is used only where the backend offers no platform equivalent (bus disable/reactivate, driver assign/unassign, per-bus trips, driver roster) — clarified 2026-09-11.
- List search/filter beyond cursor+limit is applied over loaded cursor pages and labeled as such where it matters; server-side filter support (if wanted) is a separate `bus_api` change request.
- Trip "cancel" = `PATCH` status → CANCELLED; delete = `DELETE` with confirmation (backend guards surface as Arabic errors).
- Booking "cancel" = `PATCH`/`DELETE` per backend semantics with confirmation; exact verb fixed at plan time from the contract.
- P1 members = fleet-detail Members tab (existing-user invite, role/status change, remove) PLUS the `/drivers` roster (clarified 2026-09-11): driver list with filters, invite via existing user or fresh phone+name+password, role/status change with warning, removal ending membership + assignment. Pure user administration (non-driver users, roles assignment) stays in P2 governance.
- P1 extends (never forks) the P0 proxy, error map, stores, guard, and copy deck; backend stays untouched.
