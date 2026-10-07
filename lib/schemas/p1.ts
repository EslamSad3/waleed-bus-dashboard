import { z } from "zod";
import {
  adminVerifyPaymentSchema,
  adminFailPaymentSchema,
  adminRefundPaymentSchema,
  adminForceCancelSchema,
  adminReinstateSchema,
  adminOperationalOverrideSchema,
  adminResolveReportSchema,
} from "./admin-bookings";
import { t } from "@/lib/i18n/t";
import { createUserSchema, updateUserSchema, createRoleSchema, updateRoleSchema, userRolesSchema, rolePermissionsSchema, notificationSchema, serviceConfigSchema } from "./admin-forms";

/**
 * Per-resource zod schemas + proxy registry.
 * The generic `app/api/[...proxy]` forwarder validates mutation bodies against
 * the schema registered for (method, pathname) BEFORE forwarding — the same
 * schemas are imported by the client forms (Principle V: trust-boundary
 * re-validation). Constraints mirror `docs/openapi.json` DTOs exactly.
 *
 * Owner tenants: the owner user id is the tenant id, so every owner-scoped
 * route is `/fleet-owners/{ownerId}/…` and a trip's endpoints always derive
 * from its trip line (never accepted in a body).
 */

const uuid = z.uuid(t("validation.uuid"));
const name255 = z.string(t("validation.required")).trim().min(1, t("validation.required")).max(255, t("validation.maxLength", { max: 255 }));
const egyptPhone = z
  .string()
  .regex(/^(\+20|0)1[0-9]{9}$/, t("validation.phone"));
const password = z.string(t("validation.passwordMin")).min(8, t("validation.passwordMin")).max(128);
const nickname = z.string(t("validation.nicknameRequired")).trim().min(1, t("validation.nicknameRequired")).max(100, t("validation.maxLength", { max: 100 }));
const nationalId = z
  .union([z.string().regex(/^\d{14}$/, t("validation.nationalIdDigits")), z.literal("")])
  .optional()
  .transform((value) => value || undefined);
const capacity = z
  .number(t("validation.capacityRange"))
  .int(t("validation.capacityRange"))
  .min(1, t("validation.capacityRange"))
  .max(300, t("validation.capacityRange"));
const datetime = z
  .string(t("validation.date"))
  .refine((s) => !Number.isNaN(Date.parse(s)), t("validation.date"));
const fare = z.string(t("validation.fare")).trim().regex(/^\d+(?:\.\d{1,2})?$/, t("validation.fare"));

const memberStatus = z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]);
const tripStatus = z.enum(["SCHEDULED", "DEPARTED", "COMPLETED", "CANCELLED"]);
const bookingStatus = z.enum(["CONFIRMED", "CANCELLED"]);

// ---- Owner account onboarding (platform) ----
export const createFleetOwnerSchema = z.object({
  name: name255,
  nickname,
  phone: egyptPhone,
  password,
  picture: z.string().max(1024).optional(),
  nationalId,
  vipTierId: uuid.nullable().optional(),
});
export const updateFleetOwnerSchema = z.object({
  name: name255.optional(),
  nickname: nickname.optional(),
  phone: egyptPhone.optional(),
  vipTierId: uuid.nullable().optional(),
  picture: z.string().max(1024).optional(),
  nationalId: z.union([z.string().regex(/^\d{14}$/, t("validation.nationalIdDigits")), z.literal("")]).optional(),
  isActive: z.boolean().optional(),
});

// ---- Buses (owner-scoped CRUD) ----
const httpsUrl = z.url(t("validation.httpsUrl")).refine(
  (value) => value.startsWith("https://"),
  t("validation.httpsUrl"),
);
const modelYear = z.number(t("validation.modelYear")).int(t("validation.modelYear")).min(1980, t("validation.modelYear")).max(2100, t("validation.modelYear"));
export const createBusSchema = z.object({
  registrationNumber: z.string(t("validation.required")).max(50).optional(),
  plateNumber: z.string(t("validation.plateRequired")).min(1, t("validation.plateRequired")).max(50),
  color: z.string(t("validation.colorRequired")).min(1, t("validation.colorRequired")).max(50),
  imageUrl: httpsUrl,
  brandId: uuid.nullable().optional(),
  isAirConditioned: z.boolean().optional(),
  modelYear: modelYear.optional(),
  capacity,
});
export const updateBusSchema = z.object({
  plateNumber: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
  imageUrl: httpsUrl.optional(),
  brandId: uuid.nullable().optional(),
  isAirConditioned: z.boolean().optional(),
  modelYear: modelYear.optional(),
  capacity: capacity.optional(),
  isActive: z.boolean().optional(),
});
export const createBrandSchema = z.object({
  name: z.string(t("validation.brandNameRequired")).min(1, t("validation.brandNameRequired")).max(100),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export const updateBrandSchema = z.object({
  name: z.string().min(1, t("validation.brandNameRequired")).max(100).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export const createVipTierSchema = z.object({
  name: z.string(t("validation.tierNameRequired")).min(1, t("validation.tierNameRequired")).max(100),
  rank: z.number(t("validation.rankRequired")).int(t("validation.rankRequired")).min(1, t("validation.rankRequired")),
  isActive: z.boolean().optional(),
});
export const updateVipTierSchema = z.object({
  name: z.string().min(1, t("validation.tierNameRequired")).max(100).optional(),
  rank: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});
export const assignDriverSchema = z.object({ driverUserId: uuid });

// ---- Trip lines (owner-scoped; ONE direction, one ordered stop list) ----
const tripLineStop = z.object({ stopId: uuid, stopType: z.enum(["BOARDING", "LANDING"], t("validation.stopType")), estimatedStopMinutes: z.number().int().min(0).optional() });
export const createTripLineSchema = z.object({
  name: name255,
  code: z.string(t("validation.lineCodeRequired")).min(1, t("validation.lineCodeRequired")).max(50),
  qrIdentifier: z.string().min(1).max(100).optional(),
  stops: z.array(tripLineStop).min(2, t("validation.lineStops")),
});
export const updateTripLineSchema = z.object({
  name: name255.optional(),
  isActive: z.boolean().optional(),
});
export const updateLineStopsSchema = z.object({
  stops: z.array(tripLineStop).min(2, t("validation.lineStops")),
});

// ---- Trips (nested under their line; no From/To, no direction) ----
export const createTripSchema = z.object({
  busId: uuid,
  departAt: datetime,
  fare: fare.optional(),
  status: tripStatus.optional(),
});
export const updateTripSchema = z.object({
  departAt: datetime.optional(),
  fare: fare.optional(),
  status: tripStatus.optional(),
  /** The trip's own driver; null clears it. Rejected by the API after departure. */
  driverUserId: uuid.nullable().optional(),
});

// ---- Bookings ----
export const createBookingSchema = z.object({
  tripId: uuid,
  passengerName: name255,
  passengerPhone: egyptPhone,
  status: bookingStatus.optional(),
});
export const updateBookingSchema = z.object({
  passengerName: name255.optional(),
  passengerPhone: egyptPhone.optional(),
  status: bookingStatus.optional(),
});

// ---- Owner members (owner-scoped) ----
export const addMemberSchema = z.object({
  userId: uuid,
  roleSlug: z.string(t("validation.roleRequired")).min(1, t("validation.roleRequired")).max(100).optional(),
  roleId: uuid.optional(),
  status: memberStatus.optional(),
});
export const updateMemberSchema = z.object({
  roleSlug: z.string(t("validation.roleRequired")).min(1, t("validation.roleRequired")).max(100).optional(),
  status: memberStatus.optional(),
});

// ---- Driver roster (owner-scoped) ----
const driverFromUser = z.object({
  userId: uuid,
  name: z.string().max(255).optional(),
  nickname: z.string().max(100).optional(),
  phone: z.string().optional(),
  nationalId: z.string().regex(/^\d{14}$/, t("validation.nationalIdDigits")).optional(),
  picture: z.string().max(1024).optional(),
  password: z.string().optional(),
  roleSlug: z.string(t("validation.roleRequired")).min(1, t("validation.roleRequired")).max(100).optional(),
});
export const driverFreshSchema = z.object({
  userId: z.undefined().optional(),
  name: z.string(t("validation.required")).min(1, t("validation.required")).max(255),
  nickname,
  phone: egyptPhone,
  password,
  picture: z.string().max(1024).optional(),
  nationalId,
  roleSlug: z.string(t("validation.roleRequired")).min(1, t("validation.roleRequired")).max(100).optional(),
});
/** Backend: either userId OR phone+name+password (else 422). */
export const addDriverSchema = z.union([driverFromUser, driverFreshSchema]);

/**
 * Platform driver creation (`POST /fleet-owners/drivers`).
 *
 * Every created driver is an EMPLOYED driver under the owner the operator
 * picks: `ownerId` is required and the retired `mode` field is gone (the
 * server 400s unknown fields, so it must not be sent at all). The server owns
 * the role, so `roleSlug` is not part of this contract at all — a strict zod
 * object rejects it at the proxy boundary with a field error instead of
 * forwarding a privilege-escalation attempt.
 */
const createDriverAccountBase = z.object({
  ownerId: z.uuid(t("validation.ownerRequired")),
  name: z.string().max(255).optional(),
  nickname: z.string().max(100).optional(),
  phone: egyptPhone,
  password,
  picture: z.string().max(1024).optional(),
  nationalId,
});
export const createDriverAccountSchema = createDriverAccountBase.strict();
export const updateDriverSchema = z.object({
  roleSlug: z.string(t("validation.roleRequired")).min(1, t("validation.roleRequired")).max(100).optional(),
  status: memberStatus.optional(),
  name: z.string(t("validation.nameRequired")).min(1, t("validation.nameRequired")).max(255).optional(),
  nickname: z.string(t("validation.nicknameRequired")).min(1, t("validation.nicknameRequired")).max(100).optional(),
  phone: egyptPhone.optional(),
  nationalId: z.union([z.string().regex(/^\d{14}$/, t("validation.nationalIdDigits")), z.literal("")]).optional(),
  password: z.string(t("validation.passwordMin")).min(8, t("validation.passwordMin")).max(128).optional(),
  picture: z.string().max(1024).optional(),
});

// ---- Stop points and geography (platform catalog) ----
const latitude = z.number(t("validation.latitude")).min(-90, t("validation.latitude")).max(90, t("validation.latitude"));
const longitude = z.number(t("validation.longitude")).min(-180, t("validation.longitude")).max(180, t("validation.longitude"));
export const createStopSchema = z.object({
  name: name255,
  address: z.string().min(1).max(500).optional(),
  latitude,
  longitude,
  governorateId: uuid,
  localityId: uuid.nullable().optional(),
  isActive: z.boolean().optional(),
});
export const updateStopSchema = z.object({
  name: name255.optional(), address: z.string().min(1).max(500).nullable().optional(),
  latitude: latitude.optional(), longitude: longitude.optional(), governorateId: uuid.optional(), localityId: uuid.nullable().optional(), isActive: z.boolean().optional(),
});
const markazCode = z
  .string(t("validation.markazCodeRequired"))
  .min(1, t("validation.markazCodeRequired"))
  .max(50, t("validation.maxLength", { max: 50 }))
  .regex(/^[A-Z0-9_-]+$/, t("validation.markazCodeFormat"));
export const createMarkazSchema = z.object({
  governorateId: z
    .string(t("validation.governorateRequired"))
    .min(1, t("validation.governorateRequired"))
    .refine(
      (value) => z.uuid(t("validation.uuid")).safeParse(value).success,
      t("validation.governorateRequired"),
    ),
  code: markazCode,
  nameAr: name255,
  nameEn: name255,
  isActive: z.boolean().optional(),
});
export const updateMarkazSchema = z.object({
  governorateId: uuid.optional(),
  code: markazCode.optional(),
  nameAr: name255.optional(), nameEn: name255.optional(), isActive: z.boolean().optional(),
});
export const createLocalitySchema = z.object({
  markazId: uuid,
  type: z.enum(["CITY", "VILLAGE"], t("validation.localityType")),
  nameAr: name255,
  nameEn: name255,
  isActive: z.boolean().optional(),
});
export const updateLocalitySchema = z.object({
  nameAr: name255.optional(), nameEn: name255.optional(), isActive: z.boolean().optional(),
});

// ---- Promotions (platform) ----
/** FIXED-only discount codes; `maxTotalUses: null` means unlimited. */
const promotionCode = z
  .string(t("validation.required"))
  .regex(/^[A-Za-z0-9_-]{3,32}$/, t("validation.promoCode"));
const positiveAmount = z.number(t("validation.required")).positive(t("validation.required"));
const maxUses = z.number(t("validation.required")).int(t("validation.required")).min(1, t("validation.required"));
const optionalDate = z.union([datetime, z.null()]);
const targetUserIds = z.array(uuid).max(1000).optional();
export const createPromotionSchema = z.object({
  code: promotionCode,
  type: z.literal("FIXED"),
  value: positiveAmount,
  isGlobal: z.boolean().optional(),
  targetUserIds,
  maxUsesPerUser: maxUses.optional(),
  maxTotalUses: z.union([maxUses, z.null()]).optional(),
  startsAt: optionalDate.optional(),
  expiresAt: optionalDate.optional(),
});
export const updatePromotionSchema = z.object({
  value: positiveAmount.optional(),
  targetUserIds,
  maxUsesPerUser: maxUses.optional(),
  maxTotalUses: z.union([maxUses, z.null()]).optional(),
  startsAt: optionalDate.optional(),
  expiresAt: optionalDate.optional(),
  isActive: z.boolean().optional(),
});

// ---- Registry ----
export type RegistryEntry = {
  method: "POST" | "PATCH" | "PUT";
  /** Matched against the query-stripped proxy pathname. */
  pattern: RegExp;
  schema: z.ZodType;
  /** Bare-409 `CONFLICT` context message key (research R3). */
  conflictKey?: "REGISTRATION_TAKEN" | "OWNER_LINK" | "MEMBER_EXISTS";
};

const SEG = "[^/]+";
/** Owner tenant prefix: `/fleet-owners/{ownerId}/…`. */
const OWNER = `^/fleet-owners/${SEG}`;

export const P1_REGISTRY: RegistryEntry[] = [
  { method: "POST", pattern: /^\/users$/, schema: createUserSchema },
  { method: "PATCH", pattern: new RegExp(`^/users/${SEG}$`), schema: updateUserSchema },
  { method: "PUT", pattern: new RegExp(`^/users/${SEG}/roles$`), schema: userRolesSchema },
  { method: "POST", pattern: /^\/roles$/, schema: createRoleSchema },
  { method: "PATCH", pattern: new RegExp(`^/roles/${SEG}$`), schema: updateRoleSchema },
  { method: "PUT", pattern: new RegExp(`^/roles/${SEG}/permissions$`), schema: rolePermissionsSchema },
  { method: "POST", pattern: /^\/platform\/notifications$/, schema: notificationSchema },
  { method: "PUT", pattern: /^\/platform\/config\/customer-service$/, schema: serviceConfigSchema },
  // ---- Owner accounts (platform) ----
  { method: "POST", pattern: /^\/fleet-owners$/, schema: createFleetOwnerSchema },
  { method: "PATCH", pattern: new RegExp(`^/fleet-owners/${SEG}$`), schema: updateFleetOwnerSchema },
  // ---- Owner members ----
  { method: "POST", pattern: new RegExp(`${OWNER}/members$`), schema: addMemberSchema, conflictKey: "MEMBER_EXISTS" },
  { method: "PATCH", pattern: new RegExp(`${OWNER}/members/${SEG}$`), schema: updateMemberSchema },
  // ---- Owner buses ----
  { method: "POST", pattern: new RegExp(`${OWNER}/buses$`), schema: createBusSchema, conflictKey: "REGISTRATION_TAKEN" },
  { method: "PATCH", pattern: new RegExp(`${OWNER}/buses/${SEG}$`), schema: updateBusSchema, conflictKey: "REGISTRATION_TAKEN" },
  { method: "POST", pattern: new RegExp(`${OWNER}/buses/${SEG}/driver$`), schema: assignDriverSchema },
  // ---- Owner trip lines ----
  { method: "POST", pattern: new RegExp(`${OWNER}/trip-lines$`), schema: createTripLineSchema },
  { method: "PATCH", pattern: new RegExp(`${OWNER}/trip-lines/${SEG}$`), schema: updateTripLineSchema },
  { method: "PATCH", pattern: new RegExp(`${OWNER}/trip-lines/${SEG}/stops$`), schema: updateLineStopsSchema },
  // ---- Owner trips (nested under their line) ----
  { method: "POST", pattern: new RegExp(`${OWNER}/trip-lines/${SEG}/trips$`), schema: createTripSchema },
  { method: "PATCH", pattern: new RegExp(`${OWNER}/trip-lines/${SEG}/trips/${SEG}$`), schema: updateTripSchema },
  // ---- Owner bookings ----
  { method: "POST", pattern: new RegExp(`${OWNER}/bookings$`), schema: createBookingSchema },
  { method: "PATCH", pattern: new RegExp(`${OWNER}/bookings/${SEG}$`), schema: updateBookingSchema },
  // ---- Owner driver roster ----
  { method: "POST", pattern: new RegExp(`${OWNER}/drivers$`), schema: addDriverSchema, conflictKey: "MEMBER_EXISTS" },
  { method: "PATCH", pattern: new RegExp(`${OWNER}/drivers/${SEG}$`), schema: updateDriverSchema },
  // Platform driver account creation. Declared BEFORE the owner-scoped entry is
  // unnecessary (the patterns cannot both match) but kept adjacent to the roster
  // for readability.
  { method: "POST", pattern: /^\/fleet-owners\/drivers$/, schema: createDriverAccountSchema },
  // ---- Platform catalog ----
  { method: "POST", pattern: /^\/brands$/, schema: createBrandSchema },
  { method: "PATCH", pattern: new RegExp(`^/brands/${SEG}$`), schema: updateBrandSchema },
  { method: "POST", pattern: /^\/vip-tiers$/, schema: createVipTierSchema },
  { method: "PATCH", pattern: new RegExp(`^/vip-tiers/${SEG}$`), schema: updateVipTierSchema },
  { method: "POST", pattern: /^\/stops$/, schema: createStopSchema },
  { method: "PATCH", pattern: new RegExp(`^/stops/${SEG}$`), schema: updateStopSchema },
  { method: "POST", pattern: /^\/markaz$/, schema: createMarkazSchema },
  { method: "PATCH", pattern: new RegExp(`^/markaz/${SEG}$`), schema: updateMarkazSchema },
  { method: "POST", pattern: /^\/localities$/, schema: createLocalitySchema },
  { method: "PATCH", pattern: new RegExp(`^/localities/${SEG}$`), schema: updateLocalitySchema },
  // ---- Promotions ----
  { method: "POST", pattern: /^\/platform\/promotions$/, schema: createPromotionSchema },
  { method: "PATCH", pattern: new RegExp(`^/platform/promotions/${SEG}$`), schema: updatePromotionSchema },
  // ---- Super Admin Booking Review & Payment Reconciliation ----
  { method: "POST", pattern: new RegExp(`^/admin/bookings/${SEG}/payment/verify$`), schema: adminVerifyPaymentSchema },
  { method: "POST", pattern: new RegExp(`^/admin/bookings/${SEG}/payment/fail$`), schema: adminFailPaymentSchema },
  { method: "POST", pattern: new RegExp(`^/admin/bookings/${SEG}/payment/refund$`), schema: adminRefundPaymentSchema },
  { method: "POST", pattern: new RegExp(`^/admin/bookings/${SEG}/cancel$`), schema: adminForceCancelSchema },
  { method: "POST", pattern: new RegExp(`^/admin/bookings/${SEG}/reinstate$`), schema: adminReinstateSchema },
  { method: "PATCH", pattern: new RegExp(`^/admin/bookings/${SEG}/operational$`), schema: adminOperationalOverrideSchema },
  { method: "PATCH", pattern: new RegExp(`^/admin/bookings/${SEG}/reports/${SEG}$`), schema: adminResolveReportSchema },
];

export function findRegistryEntry(method: string, pathname: string): RegistryEntry | undefined {
  return P1_REGISTRY.find((e) => e.method === method && e.pattern.test(pathname));
}

export type CreateFleetOwnerInput = z.infer<typeof createFleetOwnerSchema>;
export type UpdateFleetOwnerInput = z.infer<typeof updateFleetOwnerSchema>;
export type CreateBusInput = z.infer<typeof createBusSchema>;
export type CreateTripLineInput = z.infer<typeof createTripLineSchema>;
export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type AssignDriverInput = z.infer<typeof assignDriverSchema>;
export type AddDriverInput = z.infer<typeof addDriverSchema>;
export type CreateDriverAccountInput = z.infer<typeof createDriverAccountSchema>;
