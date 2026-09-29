import { t } from "@/lib/i18n/t";

/**
 * Backend error-code → message key (PRD §9 + contracts/error-map.ar-EG.json).
 * The Arabic copy itself lives in lib/i18n/ar.json under `errors.*`; this map is
 * the only place a backend code is bound to a key. Unknown codes fall back to a
 * generic message — never leak raw backend messages to the UI.
 */
export const AR_ERROR_MAP: Record<string, string> = {

  AUTHENTICATION_FAILED: t("errors.AUTHENTICATION_FAILED"),
  ACCOUNT_ALREADY_EXISTS: t("errors.ACCOUNT_ALREADY_EXISTS"),
  ROLE_CONFIGURATION_INVALID: t("errors.ROLE_CONFIGURATION_INVALID"),
  BUS_ACTION_NOT_ALLOWED: t("errors.BUS_ACTION_NOT_ALLOWED"),
  DRIVER_ASSIGNMENT_NOT_ALLOWED: t("errors.DRIVER_ASSIGNMENT_NOT_ALLOWED"),
  /** A trip that already left keeps its driver: it is a historical fact. */
  TRIP_DRIVER_FROZEN: t("errors.TRIP_DRIVER_FROZEN"),
  /** Departure with no driver on the trip and none on the bus. */
  DRIVER_ASSIGNMENT_REQUIRED: t("errors.DRIVER_ASSIGNMENT_REQUIRED"),
  RESOURCE_NOT_OWNED: t("errors.RESOURCE_NOT_OWNED"),
  BUS_ACCESS_DENIED: t("errors.BUS_ACCESS_DENIED"),
  NOT_FOUND: t("errors.NOT_FOUND"),
  CONFLICTING_ASSIGNMENT: t("errors.CONFLICTING_ASSIGNMENT"),
  /** Bare 409s (Prisma P2002/P2003 → codeless ConflictException) mapped per-screen. */
  CONFLICT: t("errors.CONFLICT"),
  VALIDATION_FAILED: t("errors.VALIDATION_FAILED"),
  BAD_REQUEST: t("errors.BAD_REQUEST"),
  FORBIDDEN: t("errors.FORBIDDEN"),
  BOOKING_NOT_FOUND: t("errors.BOOKING_NOT_FOUND"),
  BOOKING_ALREADY_CANCELLED: t("errors.BOOKING_ALREADY_CANCELLED"),
  BOOKING_NOT_CANCELLED: t("errors.BOOKING_NOT_CANCELLED"),
  SEATS_UNAVAILABLE: t("errors.SEATS_UNAVAILABLE"),
  BOOKING_SEAT_LIMIT_EXCEEDED: t("errors.BOOKING_SEAT_LIMIT_EXCEEDED"),
  INVALID_BOOKING_SEAT_LIMIT: t("errors.INVALID_BOOKING_SEAT_LIMIT"),
  PAYMENT_AMOUNT_MISMATCH: t("errors.PAYMENT_AMOUNT_MISMATCH"),
  PAYMENT_ALREADY_SETTLED: t("errors.PAYMENT_ALREADY_SETTLED"),
  REFUND_EXCEEDS_BALANCE: t("errors.REFUND_EXCEEDS_BALANCE"),
  REFUND_NOT_ELIGIBLE: t("errors.REFUND_NOT_ELIGIBLE"),
  REPORT_NOT_FOUND: t("errors.REPORT_NOT_FOUND"),
  INVALID_REPORT_STATUS: t("errors.INVALID_REPORT_STATUS"),
  INVALID_GOVERNORATE: t("errors.INVALID_GOVERNORATE"),
  INVALID_MARKAZ: t("errors.INVALID_MARKAZ"),
  INVALID_LOCALITY: t("errors.INVALID_LOCALITY"),
  INVALID_GEO_HIERARCHY: t("errors.INVALID_GEO_HIERARCHY"),
  MARKAZ_IN_USE: t("errors.MARKAZ_IN_USE"),
  LOCALITY_IN_USE: t("errors.LOCALITY_IN_USE"),
  STOP_IN_USE: t("errors.STOP_IN_USE"),
  INVALID_BRAND: t("errors.INVALID_BRAND"),
  BRAND_IN_USE: t("errors.BRAND_IN_USE"),
  VIP_TIER_IN_USE: t("errors.VIP_TIER_IN_USE"),
  OWNER_HAS_FLEETS: t("errors.OWNER_HAS_FLEETS"),
  PROMO_IN_USE: t("errors.PROMO_IN_USE"),
  ROLE_IN_USE: t("errors.ROLE_IN_USE"),
  TRIP_HAS_BOOKINGS: t("errors.TRIP_HAS_BOOKINGS"),
  BUS_HAS_TRIPS: t("errors.BUS_HAS_TRIPS"),
  BUS_HAS_ASSIGNMENTS: t("errors.BUS_HAS_ASSIGNMENTS"),
  BUS_IS_FAVORITED: t("errors.BUS_IS_FAVORITED"),
  INVALID_VEHICLE_YEAR: t("errors.INVALID_VEHICLE_YEAR"),
  VIP_TIER_NOT_AVAILABLE: t("errors.VIP_TIER_NOT_AVAILABLE"),
  INVALID_IMAGE_TYPE: t("errors.INVALID_IMAGE_TYPE"),
  IMAGE_TOO_LARGE: t("errors.IMAGE_TOO_LARGE"),
  STORAGE_NOT_CONFIGURED: t("errors.STORAGE_NOT_CONFIGURED"),
  STORAGE_UPLOAD_FAILED: t("errors.STORAGE_UPLOAD_FAILED"),
  STORAGE_TIMEOUT: t("errors.STORAGE_TIMEOUT"),
  UPLOAD_SIGN_FAILED: t("errors.UPLOAD_SIGN_FAILED"),
  UPLOAD_CLEANUP_FAILED: t("errors.UPLOAD_CLEANUP_FAILED"),
  IMAGE_PROCESSOR_UNAVAILABLE: t("errors.IMAGE_PROCESSOR_UNAVAILABLE"),
  UPSTREAM_TIMEOUT: t("errors.UPSTREAM_TIMEOUT"),
  UPSTREAM_UNAVAILABLE: t("errors.UPSTREAM_UNAVAILABLE"),
  FORBIDDEN_PLATFORM_ACCESS: t("errors.FORBIDDEN_PLATFORM_ACCESS"),
  JUSTIFICATION_REQUIRED: t("errors.JUSTIFICATION_REQUIRED"),
  RATE_LIMITED: t("errors.RATE_LIMITED"),
  RATE_LIMITED_429: t("errors.RATE_LIMITED_429"),
  NETWORK_ERROR: t("errors.NETWORK_ERROR"),
  UNKNOWN: t("errors.UNKNOWN"),
};

/**
 * Per-screen bare-409 `CONFLICT` messages (research R3). The backend emits
 * codeless 409s for duplicates/references, so the CALLING screen supplies the
 * context — never sniff English backend messages.
 */
export const CONFLICT_MESSAGES = {
  REGISTRATION_TAKEN: t("errors.REGISTRATION_TAKEN"),
  FLEET_REFERENCED: t("errors.FLEET_REFERENCED"),
  MEMBER_EXISTS: t("errors.MEMBER_EXISTS"),
  OWNER_LINK: t("errors.OWNER_LINK"),
} as const;

export type ConflictKey = keyof typeof CONFLICT_MESSAGES;

export function conflictMessage(key: ConflictKey | undefined): string {
  return (key && CONFLICT_MESSAGES[key]) || AR_ERROR_MAP.CONFLICT;
}

export type BackendFailure = {
  statusCode: number;
  code?: string;
  message?: string;
  details?: { fields?: Record<string, string | string[]> } & Record<string, unknown>;
};

export function toArabicError(code: string | undefined, status?: number): string {
  if (status === 429) return AR_ERROR_MAP.RATE_LIMITED_429;
  if (!code) return AR_ERROR_MAP.UNKNOWN;
  return AR_ERROR_MAP[code] ?? AR_ERROR_MAP.UNKNOWN;
}

/**
 * The error code is translated by `toArabicError`, but the backend's per-field
 * messages are not: our own zod messages are already Arabic, while
 * class-validator ones ("property releaseSeats should not exist") would reach an
 * Arabic screen verbatim. Any message with no Arabic letters becomes a generic
 * Arabic one, so framework internals never leak and the field name still points
 * at the input that is wrong.
 */
/** True when a string contains Arabic script. Used to tell our own translated
 *  messages apart from raw framework text. */
const ARABIC_SCRIPT = /\p{Script=Arabic}/u;

export function arabiciseDetails<T extends { fields?: Record<string, string | string[]> }>(
  details: T,
): T {
  if (!details.fields) return details;
  const fallback = t("errors.invalidField");
  return {
    ...details,
    fields: Object.fromEntries(
      Object.entries(details.fields).map(([key, value]) => {
        const message = Array.isArray(value) ? value.join(t("common.listSeparator")) : value;
        return [key, message && ARABIC_SCRIPT.test(message) ? message : fallback];
      }),
    ),
  };
}
