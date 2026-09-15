import { z } from "zod";

/**
 * P1 per-resource zod schemas + proxy registry (research R2).
 * The generic `app/api/[...proxy]` forwarder validates mutation bodies against
 * the schema registered for (method, pathname) BEFORE forwarding — same schemas
 * are imported by client forms (Principle V: trust-boundary re-validation).
 * Constraints mirror `docs/openapi.json` DTOs exactly.
 */

const uuid = z.uuid("معرف غير صحيح");
const name255 = z.string("الحقل ده مطلوب").min(1, "الحقل ده مطلوب").max(255);
const egyptPhone = z
  .string()
  .regex(/^(\+20|0)1[0-9]{9}$/, "رقم الموبايل لازم يبقى 11 رقم يبدأ بـ 01");
const password = z.string("كلمة السر لازم تبقى 8 حروف على الأقل").min(8, "كلمة السر لازم تبقى 8 حروف على الأقل").max(128);
const nickname = z.string("اسم الشهرة مطلوب").min(1, "اسم الشهرة مطلوب").max(100);
const nationalId = z
  .union([z.string().regex(/^\d{14}$/, "الرقم القومي لازم يكون 14 رقم"), z.literal("")])
  .optional()
  .transform((value) => value || undefined);
const capacity = z
  .number("السعة من 1 لـ 300")
  .int("السعة من 1 لـ 300")
  .min(1, "السعة من 1 لـ 300")
  .max(300, "السعة من 1 لـ 300");
const datetime = z
  .string("التاريخ غير صحيح")
  .refine((s) => !Number.isNaN(Date.parse(s)), "التاريخ غير صحيح");

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
  nationalId: z.union([z.string().regex(/^\d{14}$/, "الرقم القومي لازم يكون 14 رقم"), z.literal("")]).optional(),
  isActive: z.boolean().optional(),
});

// ---- Fleets ----
export const createFleetSchema = z.object({
  name: name255,
  ownerId: uuid,
  ownerRoleSlug: z.string("دور المالك الابتدائي غير صحيح").min(1, "دور المالك الابتدائي غير صحيح").max(100).optional(),
});
export const updateFleetSchema = z.object({
  name: name255.optional(),
  isActive: z.boolean().optional(),
});

// ---- Buses (platform CRUD) ----
export const createBusSchema = z.object({
  registrationNumber: z.string("الحقل ده مطلوب").min(1, "الحقل ده مطلوب").max(50),
  plateNumber: z.string().max(50).optional(),
  capacity,
});
export const updateBusSchema = z.object({
  plateNumber: z.string().max(50).optional(),
  capacity: capacity.optional(),
  isActive: z.boolean().optional(),
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
  passengerPhone: egyptPhone.optional(),
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
  roleSlug: z.string("اختار الدور").min(1, "اختار الدور").max(100).optional(),
  roleId: uuid.optional(),
  status: memberStatus.optional(),
});
export const updateMemberSchema = z.object({
  roleSlug: z.string("اختار الدور").min(1, "اختار الدور").max(100).optional(),
  status: memberStatus.optional(),
});

// ---- Driver roster (tenant) ----
const driverFromUser = z.object({
  userId: uuid,
  name: z.string().max(255).optional(),
  nickname: z.string().max(100).optional(),
  phone: z.string().optional(),
  nationalId: z.string().regex(/^\d{14}$/, "الرقم القومي لازم يكون 14 رقم").optional(),
  picture: z.string().max(1024).optional(),
  password: z.string().optional(),
  roleSlug: z.string("اختار الدور").min(1, "اختار الدور").max(100).optional(),
});
export const driverFreshSchema = z.object({
  userId: z.undefined().optional(),
  name: z.string("الحقل ده مطلوب").min(1, "الحقل ده مطلوب").max(255),
  nickname,
  phone: egyptPhone,
  password,
  picture: z.string().max(1024).optional(),
  nationalId,
  roleSlug: z.string("اختار الدور").min(1, "اختار الدور").max(100).optional(),
});
/** Backend: either userId OR phone+name+password (else 422). */
export const addDriverSchema = z.union([driverFromUser, driverFreshSchema]);
export const updateDriverSchema = z.object({
  roleSlug: z.string("اختار الدور").min(1, "اختار الدور").max(100).optional(),
  status: memberStatus.optional(),
});

// ---- Stop points and trip lines (platform) ----
const latitude = z.number("خط العرض غير صحيح").min(-90, "خط العرض غير صحيح").max(90, "خط العرض غير صحيح");
const longitude = z.number("خط الطول غير صحيح").min(-180, "خط الطول غير صحيح").max(180, "خط الطول غير صحيح");
export const createStopSchema = z.object({
  name: name255,
  address: z.string("العنوان مطلوب").min(1, "العنوان مطلوب").max(500),
  latitude,
  longitude,
  isActive: z.boolean().optional(),
});
export const updateStopSchema = z.object({
  name: name255.optional(), address: z.string().min(1, "العنوان مطلوب").max(500).optional(),
  latitude: latitude.optional(), longitude: longitude.optional(), isActive: z.boolean().optional(),
});
const tripLineStop = z.object({ stopId: uuid, estimatedStopMinutes: z.number().int().min(0).optional() });
export const createTripLineSchema = z.object({
  name: name255, code: z.string("كود الخط مطلوب").min(1, "كود الخط مطلوب").max(50),
  outboundStops: z.array(tripLineStop).min(2, "اختر نقطتي توقف على الأقل في اتجاه الذهاب"),
  returnStops: z.array(tripLineStop).min(2, "اختر نقطتي توقف على الأقل في اتجاه العودة"),
  isActive: z.boolean().optional(),
});
export const updateTripLineSchema = z.object({
  name: name255.optional(), code: z.string().min(1, "كود الخط مطلوب").max(50).optional(),
  isActive: z.boolean().optional(),
});
export const updateDirectionStopsSchema = z.object({
  stops: z.array(tripLineStop).min(2, "اختر نقطتي توقف على الأقل"),
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
  { method: "POST", pattern: /^\/trip-lines$/, schema: createTripLineSchema },
  { method: "PATCH", pattern: new RegExp(`^/trip-lines/${SEG}$`), schema: updateTripLineSchema },
  { method: "PATCH", pattern: new RegExp(`^/trip-lines/${SEG}/directions/${SEG}/stops$`), schema: updateDirectionStopsSchema },
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
