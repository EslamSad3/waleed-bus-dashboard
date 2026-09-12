# Data Model: 001-platform-crud

**Source entities**: `spec.md` Key Entities + `openapi.json` DTOs (`CreateFleetDto`,
`UpdateFleetDto`, `AddMemberDto`, `UpdateMemberDto`, `CreateBusDto`/`UpdateBusDto`,
`CreateTripDto`/`UpdateTripDto`, `CreateBookingDto`/`UpdateBookingDto`,
`AssignDriverDto`, `AddDriverDto`/`UpdateDriverDto`, entity `FleetDto`, `BusDto`,
`TripDto`, `BookingDto`, `FleetMemberDto`). P1 creates NO backend tables; all
models below are frontend form/transfer/view shapes. P0 `Session`, `ProxyEnvelope`,
`CursorPage` shapes are reused unchanged.

## Fleet (platform `/fleets`)

| Field | Type | Validation (zod, mirrored in proxy registry) |
|---|---|---|
| `id` | string (uuid) | Required, path param |
| `name` | string | 1–255, required ("الحقل ده مطلوب") |
| `ownerId` | string (uuid) | Required on create; picked from `GET /users` |
| `ownerRoleSlug` | string | Optional on create (e.g. `fleet-owner`) |
| `isActive` | boolean | Optional on edit (activate/deactivate toggle) |
| `createdAt`/`updatedAt` | date-time strings | Display only |

- State transitions: `active ⇄ inactive` (PATCH `isActive`); delete allowed only when unreferenced (else 409 `CONFLICT` → fleet-referenced Arabic message, entity kept).

## Bus (platform `/fleets/{fleetId}/buses`; lifecycle tenant `/fleet/buses/{busId}`)

| Field | Type | Validation |
|---|---|---|
| `id` / `fleetId` | string (uuid) | Required, path/scope |
| `registrationNumber` | string | 1–50, required, unique per fleet (409 `CONFLICT` → "رقم التسجيل مستخدم قبل كده") |
| `plateNumber` | string | ≤ 50, optional |
| `capacity` | number | Integer 1–300 ("السعة من 1 لـ 300") |
| `isActive` | boolean | Edit toggle; lifecycle via disable/reactivate actions |

- Lifecycle transitions: `active → disabled` (`POST …/disable`; blocked by DEPARTED trip → 409 `BUS_ACTION_NOT_ALLOWED`); `disabled → active` (`POST …/reactivate`); redundant transitions 409 with the same explicit code (surface message, keep state).
- Driver assignment: `driverUserId` (uuid, required) → `POST …/driver` (ends prior ACTIVE row; re-assign same driver reports success, no duplicate); `DELETE …/driver` ends assignment (history kept). 409 `DRIVER_ASSIGNMENT_NOT_ALLOWED` → Arabic driver message.

## Trip (platform `/fleets/{fleetId}/trips`)

| Field | Type | Validation |
|---|---|---|
| `id` / `fleetId` / `busId` | string (uuid) | `busId` required on create, MUST belong to same fleet (else 404 `RESOURCE_NOT_OWNED` → "العنصر مش موجود في الأسطول ده") |
| `origin` / `destination` | string | 1–255, required |
| `departAt` | date-time string | Required, valid date-time |
| `status` | `SCHEDULED\|DEPARTED\|COMPLETED\|CANCELLED` | Defaults SCHEDULED; any transition accepted (no backend state machine — R5) |

- Cancel = PATCH `{status:'CANCELLED'}`; delete = DELETE + confirm.

## Booking (platform `/fleets/{fleetId}/bookings`)

| Field | Type | Validation |
|---|---|---|
| `id` / `fleetId` / `tripId` | string (uuid) | `tripId` required on create, same-fleet enforced (else 404 Arabic) |
| `passengerName` | string | 1–255, required ("الحقل ده مطلوب") |
| `passengerPhone` | string | Optional (Egyptian mobile shape validated client-side when present) |
| `seats` | number | ≥ 1 (backend-owned; display + create default 1) |
| `status` | `CONFIRMED\|CANCELLED` | Defaults CONFIRMED |

- Cancel = PATCH `{status:'CANCELLED'}` + confirm; delete = DELETE + confirm.
- Detail carries timeline (status/payment) + per-side ratings 1–5 (`BookingRatingDto`) when present (read-only in P1).

## FleetMember (platform `/fleets/{fleetId}/members`)

| Field | Type | Validation |
|---|---|---|
| `id` / `fleetId` / `userId` / `roleId` | string (uuid) | `userId` required on add (must exist + active, else 404 Arabic) |
| `roleSlug` / `roleId` | string | Role picker from `GET /roles`; `roleId` wins when both given |
| `status` | `ACTIVE\|SUSPENDED\|REVOKED` | Defaults ACTIVE on add |

- Transitions: any status change allowed; → SUSPENDED/REVOKED or remove shows session-revocation warning + requires confirm (backend invalidates target sessions immediately, `authVersion` bump).
- Duplicate add → 409 `CONFLICT` → member-exists Arabic message (screen context, R3).

## DriverRoster (tenant `/fleet/drivers`, view + invite)

| Field | Type | Validation |
|---|---|---|
| Existing-user invite | `userId` (uuid) | Either `userId` OR fresh credentials (backend 422 `VALIDATION_FAILED` otherwise) |
| Fresh invite | `name` (≤255) + `phone` (Egyptian mobile) + `password` (8–128) | All three required together |
| `roleSlug` | string | Defaults `driver`; non-driver-capable role → 409 `DRIVER_ASSIGNMENT_NOT_ALLOWED` |
| Status change | `roleSlug` / `status` | Same warning + confirm rules as FleetMember |

- Detail: membership + assignment history rows (ACTIVE/ENDED, read-only); removal ends membership + active assignment (confirm).

## FleetScope (filter state, extends P0 `stores/filters.ts`)

| Field | Type | Notes |
|---|---|---|
| `fleetId` | string (uuid) \| null | Persisted zustand + cookie; fed as `x-fleet-id` on tenant calls; null → `MISSING_FLEET_SCOPE` message on tenant screens |

## Relationships

- `Fleet 1—* Bus 1—* Trip 1—* Booking`; `Fleet 1—* FleetMember *—1 User`; `Bus 1—* AssignmentRow` (history); `DriverRoster` = fleet-scoped view over users + memberships + assignments.
- `FleetScope` selects the working fleet for tenant-path actions and pre-fills platform-path pickers.
- Every mutation flows `Form (zod) → Server Action → /api/* → proxy registry (zod re-validate) → busFetch → backend`; failures map via extended error map with per-screen `CONFLICT` context.
