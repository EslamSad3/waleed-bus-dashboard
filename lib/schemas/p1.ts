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

/**
 * P1 per-resource zod schemas + proxy registry (research R2).
 * The generic `app/api/[...proxy]` forwarder validates mutation bodies against
 * the schema registered for (method, pathname) BEFORE forwarding — same schemas
 * are imported by client forms (Principle V: trust-boundary re-validation).
 * Constraints mirror `docs/openapi.json` DTOs exactly.
 */

const uuid = z.uuid(t("validation.uuid"));
const name255 = z.string(t("validation.required")).min(1, t("validation.required")).max(255);
const egyptPhone = z
  .string()
  .regex(/^(\+20|0)1[0-9]{9}$/, t("validation.phone"));
const password = z.string(t("validation.passwordMin")).min(8, t("validation.passwordMin")).max(128);
const nickname = z.string(t("validation.nicknameRequired")).min(1, t("validation.nicknameRequired")).max(100);
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

const memberStatus = z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]);
const tripStatus = z.enum(["SCHEDULED", "DEPARTED", "COMPLETED", "CANCELLED"]);
const bookingStatus = z.enum(["CONFIRMED", "CANCELLED"]);

// ---- Fleet-owner onboarding (platform) ----
export const createFleetOwnerSchema = z.object({
  name: name255,
  nickname,
  phone: egyptPhone,
  password,
  picture: z.string().max(1024).optional(),
  nationalId,
  fleetName: name255,
});
export const updateFleetOwnerSchema = z.object({
  name: name255.optional(),
  nickname: nickname.optional(),
  phone: egyptPhone.optional(),
  picture: z.string().max(1024).optional(),
  nationalId: z.union([z.string().regex(/^\d{14}$/, t("validation.nationalIdDigits")), z.literal("")]).optional(),
  isActive: z.boolean().optional(),
});

// ---- Fleets ----
export const createFleetSchema = z.object({
  name: name255,
  ownerId: uuid,
  ownerRoleSlug: z.string(t("validation.ownerRoleSlug")).min(1, t("validation.ownerRoleSlug")).max(100).optional(),
});
export const updateFleetSchema = z.object({
  name: name255.optional(),
  isActive: z.boolean().optional(),
});

// ---- Buses (platform CRUD) ----
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
export const assignFleetVipSchema = z.object({
  vipTierId: uuid.nullable().optional(),
});
export const assignDriverSchema = z.object({ driverUserId: uuid });

// ---- Trips ----
export const createTripSchema = z.object({
  busId: uuid,
  origin: name255,
  destination: name255,
  departAt: datetime,
  routeId: uuid.optional(),
  status: tripStatus.optional(),
});
export const updateTripSchema = z.object({
  origin: name255.optional(),
  destination: name255.optional(),
  departAt: datetime.optional(),
  status: tripStatus.optional(),
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

// ---- Fleet members (platform) ----
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

// ---- Driver roster (tenant) ----
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

// ---- Stop points and trip lines (platform) ----
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
export const createMarkazSchema = z.object({
  governorateId: uuid,
  code: z.string(t("validation.markazCodeRequired")).min(1, t("validation.markazCodeRequired")).max(50),
  nameAr: name255,
  nameEn: name255,
  isActive: z.boolean().optional(),
});
export const updateMarkazSchema = z.object({
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
const tripLineStop = z.object({ stopId: uuid, stopType: z.enum(["BOARDING", "LANDING"], t("validation.stopType")), estimatedStopMinutes: z.number().int().min(0).optional() });
export const createTripLineSchema = z.object({
  name: name255, code: z.string(t("validation.lineCodeRequired")).min(1, t("validation.lineCodeRequired")).max(50),
  outboundStops: z.array(tripLineStop).min(2, t("validation.lineOutboundStops")),
  returnStops: z.array(tripLineStop).min(2, t("validation.lineReturnStops")),
  isActive: z.boolean().optional(),
});
export const updateTripLineSchema = z.object({
  name: name255.optional(), code: z.string().min(1, t("validation.lineCodeRequired")).max(50).optional(),
  isActive: z.boolean().optional(),
});
export const updateDirectionStopsSchema = z.object({
  stops: z.array(tripLineStop).min(2, t("validation.lineStops")),
});

// ---- Registry ----
export type RegistryEntry = {
  method: "POST" | "PATCH";
  /** Matched against the query-stripped proxy pathname. */
  pattern: RegExp;
  schema: z.ZodType;
  /** Bare-409 `CONFLICT` context message key (research R3). */
  conflictKey?: "REGISTRATION_TAKEN" | "FLEET_REFERENCED" | "MEMBER_EXISTS" | "OWNER_LINK";
};

const SEG = "[^/]+";

export const P1_REGISTRY: RegistryEntry[] = [
  { method: "POST", pattern: /^\/fleet-owners$/, schema: createFleetOwnerSchema },
  { method: "PATCH", pattern: new RegExp(`^/fleet-owners/${SEG}$`), schema: updateFleetOwnerSchema },
  { method: "POST", pattern: /^\/fleets$/, schema: createFleetSchema, conflictKey: "OWNER_LINK" },
  { method: "PATCH", pattern: new RegExp(`^/fleets/${SEG}$`), schema: updateFleetSchema },
  { method: "POST", pattern: new RegExp(`^/fleets/${SEG}/buses$`), schema: createBusSchema, conflictKey: "REGISTRATION_TAKEN" },
  { method: "PATCH", pattern: new RegExp(`^/fleets/${SEG}/buses/${SEG}$`), schema: updateBusSchema, conflictKey: "REGISTRATION_TAKEN" },
  { method: "POST", pattern: /^\/brands$/, schema: createBrandSchema },
  { method: "PATCH", pattern: new RegExp(`^/brands/${SEG}$`), schema: updateBrandSchema },
  { method: "POST", pattern: /^\/vip-tiers$/, schema: createVipTierSchema },
  { method: "PATCH", pattern: new RegExp(`^/vip-tiers/${SEG}$`), schema: updateVipTierSchema },
  { method: "PATCH", pattern: new RegExp(`^/fleets/${SEG}/vip$`), schema: assignFleetVipSchema },
  { method: "POST", pattern: new RegExp(`^/fleets/${SEG}/trips$`), schema: createTripSchema },
  { method: "PATCH", pattern: new RegExp(`^/fleets/${SEG}/trips/${SEG}$`), schema: updateTripSchema },
  { method: "POST", pattern: new RegExp(`^/fleets/${SEG}/bookings$`), schema: createBookingSchema },
  { method: "PATCH", pattern: new RegExp(`^/fleets/${SEG}/bookings/${SEG}$`), schema: updateBookingSchema },
  { method: "POST", pattern: new RegExp(`^/fleets/${SEG}/members$`), schema: addMemberSchema, conflictKey: "MEMBER_EXISTS" },
  { method: "PATCH", pattern: new RegExp(`^/fleets/${SEG}/members/${SEG}$`), schema: updateMemberSchema },
  { method: "POST", pattern: new RegExp(`^/fleet/buses/${SEG}/driver$`), schema: assignDriverSchema },
  { method: "POST", pattern: /^\/fleet\/drivers$/, schema: addDriverSchema, conflictKey: "MEMBER_EXISTS" },
  { method: "PATCH", pattern: new RegExp(`^/fleet/drivers/${SEG}$`), schema: updateDriverSchema },
  { method: "POST", pattern: /^\/stops$/, schema: createStopSchema },
  { method: "PATCH", pattern: new RegExp(`^/stops/${SEG}$`), schema: updateStopSchema },
  { method: "POST", pattern: /^\/markaz$/, schema: createMarkazSchema },
  { method: "PATCH", pattern: new RegExp(`^/markaz/${SEG}$`), schema: updateMarkazSchema },
  { method: "POST", pattern: /^\/localities$/, schema: createLocalitySchema },
  { method: "PATCH", pattern: new RegExp(`^/localities/${SEG}$`), schema: updateLocalitySchema },
  { method: "POST", pattern: /^\/trip-lines$/, schema: createTripLineSchema },
  { method: "PATCH", pattern: new RegExp(`^/trip-lines/${SEG}$`), schema: updateTripLineSchema },
  { method: "PATCH", pattern: new RegExp(`^/trip-lines/${SEG}/directions/${SEG}/stops$`), schema: updateDirectionStopsSchema },
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

export type CreateFleetInput = z.infer<typeof createFleetSchema>;
export type CreateFleetOwnerInput = z.infer<typeof createFleetOwnerSchema>;
export type UpdateFleetOwnerInput = z.infer<typeof updateFleetOwnerSchema>;
export type CreateBusInput = z.infer<typeof createBusSchema>;
export type CreateTripInput = z.infer<typeof createTripSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type AssignDriverInput = z.infer<typeof assignDriverSchema>;
export type AddDriverInput = z.infer<typeof addDriverSchema>;
