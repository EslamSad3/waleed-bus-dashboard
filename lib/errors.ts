import { t } from "@/lib/i18n/t";

/**
 * Backend error-code → Egyptian-Arabic message (PRD §9 +
 * contracts/error-map.ar-EG.json).
 *
 * The Arabic copy itself lives in `lib/i18n/ar.json` under `errors.*`; this map
 * is the ONLY place a backend code is bound to a key. The API sends English
 * `message` text that must never reach the screen — the proxy drops it and
 * translates `code` here instead, so an unmapped code can only ever surface as
 * a generic, status-appropriate Arabic line.
 */
export const AR_ERROR_MAP: Record<string, string> = {
  PRICING_INCOMPLETE: t("errors.PRICING_INCOMPLETE"),
  PRICING_REVISION_CONFLICT: t("errors.PRICING_REVISION_CONFLICT"),
  PRICE_CHANGED: t("errors.PRICE_CHANGED"),
  PRICE_CONFIRMATION_REQUIRED: t("errors.PRICE_CONFIRMATION_REQUIRED"),
  TRIP_FARE_MANAGED_ON_LINE: t("errors.TRIP_FARE_MANAGED_ON_LINE"),

  // --- identity and access ---
  AUTHENTICATION_FAILED: t("errors.AUTHENTICATION_FAILED"),
  ACCOUNT_ALREADY_EXISTS: t("errors.ACCOUNT_ALREADY_EXISTS"),
  ROLE_CONFIGURATION_INVALID: t("errors.ROLE_CONFIGURATION_INVALID"),
  FORBIDDEN: t("errors.FORBIDDEN"),
  FORBIDDEN_PLATFORM_ACCESS: t("errors.FORBIDDEN_PLATFORM_ACCESS"),
  PHONE_NOT_VERIFIED: t("errors.PHONE_NOT_VERIFIED"),
  PHONE_UNAVAILABLE: t("errors.PHONE_UNAVAILABLE"),
  PHONE_ALREADY_REGISTERED: t("errors.PHONE_ALREADY_REGISTERED"),
  PROFILE_INCOMPLETE: t("errors.PROFILE_INCOMPLETE"),
  OTP_EXPIRED: t("errors.OTP_EXPIRED"),
  OTP_INVALID: t("errors.OTP_INVALID"),
  OTP_RATE_LIMITED: t("errors.OTP_RATE_LIMITED"),
  JUSTIFICATION_REQUIRED: t("errors.JUSTIFICATION_REQUIRED"),

  // --- generic request/validation ---
  BAD_REQUEST: t("errors.BAD_REQUEST"),
  VALIDATION_FAILED: t("errors.VALIDATION_FAILED"),
  CONFLICT: t("errors.CONFLICT"),
  CONFLICTING_ASSIGNMENT: t("errors.CONFLICTING_ASSIGNMENT"),
  /** Coded Prisma integrity violations (RESOURCE_ALREADY_EXISTS / RESOURCE_IN_USE). */
  RESOURCE_ALREADY_EXISTS: t("errors.RESOURCE_ALREADY_EXISTS"),
  RESOURCE_IN_USE: t("errors.RESOURCE_IN_USE"),
  NOT_FOUND: t("errors.NOT_FOUND"),
  RESOURCE_NOT_OWNED: t("errors.RESOURCE_NOT_OWNED"),
  RATE_LIMITED: t("errors.RATE_LIMITED"),
  RATE_LIMITED_429: t("errors.RATE_LIMITED_429"),
  DATABASE_UNAVAILABLE: t("errors.DATABASE_UNAVAILABLE"),
  DATABASE_SCHEMA_OUT_OF_DATE: t("errors.DATABASE_SCHEMA_OUT_OF_DATE"),
  INTERNAL_ERROR: t("errors.INTERNAL_ERROR"),
  USER_NOT_FOUND: t("errors.USER_NOT_FOUND"),
  DRIVER_ACCOUNT_PROTECTED: t("errors.DRIVER_ACCOUNT_PROTECTED"),
  DRIVER_NOT_ASSIGNED: t("errors.DRIVER_NOT_ASSIGNED"),

  // --- fleet owners and members ---
  OWNER_HAS_FLEETS: t("errors.OWNER_HAS_FLEETS"),
  OWNER_HAS_REFERENCING_RECORDS: t("errors.OWNER_HAS_REFERENCING_RECORDS"),
  MEMBER_EXISTS: t("errors.MEMBER_EXISTS"),
  FLEET_NOT_FOUND: t("errors.FLEET_NOT_FOUND"),
  OWNER_LINK: t("errors.OWNER_LINK"),
  /** The owner's own self-membership is managed from owner administration only. */
  OWNER_DRIVER_MANAGED_AS_OWNER: t("errors.OWNER_DRIVER_MANAGED_AS_OWNER"),
  /** A fleet owner cannot be invited/assigned as an external driver elsewhere. */
  OWNER_CANNOT_DRIVE_OTHER_FLEET: t("errors.OWNER_CANNOT_DRIVE_OTHER_FLEET"),

  // --- buses and drivers ---
  BUS_ACCESS_DENIED: t("errors.BUS_ACCESS_DENIED"),
  BUS_ACTION_NOT_ALLOWED: t("errors.BUS_ACTION_NOT_ALLOWED"),
  BUS_HAS_TRIPS: t("errors.BUS_HAS_TRIPS"),
  BUS_HAS_ASSIGNMENTS: t("errors.BUS_HAS_ASSIGNMENTS"),
  BUS_IS_FAVORITED: t("errors.BUS_IS_FAVORITED"),
  DRIVER_ASSIGNMENT_NOT_ALLOWED: t("errors.DRIVER_ASSIGNMENT_NOT_ALLOWED"),
  DRIVER_ASSIGNMENT_REQUIRED: t("errors.DRIVER_ASSIGNMENT_REQUIRED"),
  TRIP_DRIVER_FROZEN: t("errors.TRIP_DRIVER_FROZEN"),

  // --- trip lines, trips, feedback ---
  LINE_HAS_TRIPS: t("errors.LINE_HAS_TRIPS"),
  STOP_IN_USE: t("errors.STOP_IN_USE"),
  STOP_NOT_FOUND: t("errors.STOP_NOT_FOUND"),
  DUPLICATE_STOP: t("errors.DUPLICATE_STOP"),
  INVALID_TRIP_STOPS: t("errors.INVALID_TRIP_STOPS"),
  ROUTE_NOT_FOUND: t("errors.ROUTE_NOT_FOUND"),
  TRIP_NOT_FOUND: t("errors.TRIP_NOT_FOUND"),
  TRIP_NOT_DELETABLE: t("errors.TRIP_NOT_DELETABLE"),
  TRIP_NOT_BOOKABLE: t("errors.TRIP_NOT_BOOKABLE"),
  TRIP_ALREADY_STARTED: t("errors.TRIP_ALREADY_STARTED"),
  TRIP_ACCESS_DENIED: t("errors.TRIP_ACCESS_DENIED"),
  TRIP_ROUTE_MISSING: t("errors.TRIP_ROUTE_MISSING"),
  INVALID_TRIP_STATE: t("errors.INVALID_TRIP_STATE"),
  INVALID_SEAT_COUNT: t("errors.INVALID_SEAT_COUNT"),
  DUPLICATE_TIME_BOOKING: t("errors.DUPLICATE_TIME_BOOKING"),
  INVALID_DROPOFF_STATE: t("errors.INVALID_DROPOFF_STATE"),
  RATING_NOT_ALLOWED: t("errors.RATING_NOT_ALLOWED"),

  // --- bookings and payments ---
  BOOKING_NOT_FOUND: t("errors.BOOKING_NOT_FOUND"),
  BOOKING_ALREADY_CANCELLED: t("errors.BOOKING_ALREADY_CANCELLED"),
  BOOKING_NOT_CANCELLABLE: t("errors.BOOKING_NOT_CANCELLABLE"),
  BOOKING_NOT_CANCELLED: t("errors.BOOKING_NOT_CANCELLED"),
  BOOKING_NOT_ON_TRIP: t("errors.BOOKING_NOT_ON_TRIP"),
  SEATS_UNAVAILABLE: t("errors.SEATS_UNAVAILABLE"),
  BOOKING_SEAT_LIMIT_EXCEEDED: t("errors.BOOKING_SEAT_LIMIT_EXCEEDED"),
  INVALID_BOOKING_SEAT_LIMIT: t("errors.INVALID_BOOKING_SEAT_LIMIT"),
  PAYMENT_AMOUNT_MISMATCH: t("errors.PAYMENT_AMOUNT_MISMATCH"),
  PAYMENT_ALREADY_SETTLED: t("errors.PAYMENT_ALREADY_SETTLED"),
  PAYMENT_NOT_ALLOWED: t("errors.PAYMENT_NOT_ALLOWED"),
  REFUND_EXCEEDS_BALANCE: t("errors.REFUND_EXCEEDS_BALANCE"),
  REFUND_NOT_ELIGIBLE: t("errors.REFUND_NOT_ELIGIBLE"),

  // --- passenger reports and shares ---
  REPORT_NOT_FOUND: t("errors.REPORT_NOT_FOUND"),
  REPORT_NOT_ALLOWED: t("errors.REPORT_NOT_ALLOWED"),
  INVALID_REPORT_STATUS: t("errors.INVALID_REPORT_STATUS"),
  INVALID_SHARE: t("errors.INVALID_SHARE"),
  INVALID_SHARE_CODE: t("errors.INVALID_SHARE_CODE"),
  SHARE_EXPIRED: t("errors.SHARE_EXPIRED"),
  SHARE_RATE_LIMITED: t("errors.SHARE_RATE_LIMITED"),

  // --- favorites ---
  FAVORITE_ALREADY_EXISTS: t("errors.FAVORITE_ALREADY_EXISTS"),
  FAVORITE_NOT_FOUND: t("errors.FAVORITE_NOT_FOUND"),
  FAVORITE_TARGET_NOT_AVAILABLE: t("errors.FAVORITE_TARGET_NOT_AVAILABLE"),
  INVALID_FAVORITE_STOPS: t("errors.INVALID_FAVORITE_STOPS"),

  // --- promotions ---
  PROMO_CODE_EXISTS: t("errors.PROMO_CODE_EXISTS"),
  PROMO_IN_USE: t("errors.PROMO_IN_USE"),
  PROMO_EXHAUSTED: t("errors.PROMO_EXHAUSTED"),
  PROMO_ALREADY_USED: t("errors.PROMO_ALREADY_USED"),
  PROMOTION_NOT_FOUND: t("errors.PROMOTION_NOT_FOUND"),
  INVALID_PROMO_CODE: t("errors.INVALID_PROMO_CODE"),
  INVALID_PROMO_TARGETS: t("errors.INVALID_PROMO_TARGETS"),
  INVALID_PROMO_VALUE: t("errors.INVALID_PROMO_VALUE"),
  INVALID_PROMO_WINDOW: t("errors.INVALID_PROMO_WINDOW"),

  // --- catalog, geography, reference data ---
  INVALID_BRAND: t("errors.INVALID_BRAND"),
  BRAND_IN_USE: t("errors.BRAND_IN_USE"),
  INVALID_VEHICLE_YEAR: t("errors.INVALID_VEHICLE_YEAR"),
  VIP_TIER_IN_USE: t("errors.VIP_TIER_IN_USE"),
  VIP_TIER_NOT_AVAILABLE: t("errors.VIP_TIER_NOT_AVAILABLE"),
  INVALID_GOVERNORATE: t("errors.INVALID_GOVERNORATE"),
  INVALID_MARKAZ: t("errors.INVALID_MARKAZ"),
  INVALID_LOCALITY: t("errors.INVALID_LOCALITY"),
  INVALID_GEO_HIERARCHY: t("errors.INVALID_GEO_HIERARCHY"),
  MARKAZ_IN_USE: t("errors.MARKAZ_IN_USE"),
  MARKAZ_GOVERNORATE_LOCKED: t("errors.MARKAZ_GOVERNORATE_LOCKED"),
  LOCALITY_IN_USE: t("errors.LOCALITY_IN_USE"),
  ROLE_IN_USE: t("errors.ROLE_IN_USE"),
  REGISTRATION_TAKEN: t("errors.REGISTRATION_TAKEN"),
  FLEET_REFERENCED: t("errors.FLEET_REFERENCED"),

  // --- notifications, service config, uploads ---
  NOTIFICATION_NOT_FOUND: t("errors.NOTIFICATION_NOT_FOUND"),
  INVALID_NOTIFICATION_REF: t("errors.INVALID_NOTIFICATION_REF"),
  INVALID_NOTIFICATION_TARGET: t("errors.INVALID_NOTIFICATION_TARGET"),
  CONFIG_ENTRY_NOT_FOUND: t("errors.CONFIG_ENTRY_NOT_FOUND"),
  CONFIG_TOO_LARGE: t("errors.CONFIG_TOO_LARGE"),
  INVALID_CONFIG_TYPE: t("errors.INVALID_CONFIG_TYPE"),
  INVALID_CONFIG_VALUE: t("errors.INVALID_CONFIG_VALUE"),
  INVALID_IMAGE_TYPE: t("errors.INVALID_IMAGE_TYPE"),
  IMAGE_TOO_LARGE: t("errors.IMAGE_TOO_LARGE"),
  STORAGE_NOT_CONFIGURED: t("errors.STORAGE_NOT_CONFIGURED"),
  STORAGE_UPLOAD_FAILED: t("errors.STORAGE_UPLOAD_FAILED"),
  STORAGE_TIMEOUT: t("errors.STORAGE_TIMEOUT"),
  UPLOAD_SIGN_FAILED: t("errors.UPLOAD_SIGN_FAILED"),
  UPLOAD_CLEANUP_FAILED: t("errors.UPLOAD_CLEANUP_FAILED"),
  IMAGE_PROCESSOR_UNAVAILABLE: t("errors.IMAGE_PROCESSOR_UNAVAILABLE"),

  // --- transport / platform ---
  UPSTREAM_TIMEOUT: t("errors.UPSTREAM_TIMEOUT"),
  UPSTREAM_UNAVAILABLE: t("errors.UPSTREAM_UNAVAILABLE"),
  NETWORK_ERROR: t("errors.NETWORK_ERROR"),
  UNKNOWN: t("errors.UNKNOWN"),
};

/**
 * Last-resort copy for a code the map does not know. Keyed by STATUS so the
 * operator still gets actionable guidance ("this is your input" vs "the server
 * is unwell") instead of one vague line for everything.
 */
const UNKNOWN_BY_STATUS: Record<number, string> = {
  400: t("errors.unknown400"),
  401: t("errors.AUTHENTICATION_FAILED"),
  403: t("errors.FORBIDDEN"),
  404: t("errors.NOT_FOUND"),
  409: t("errors.CONFLICT"),
  413: t("errors.IMAGE_TOO_LARGE"),
  422: t("errors.VALIDATION_FAILED"),
  429: t("errors.RATE_LIMITED_429"),
  500: t("errors.INTERNAL_ERROR"),
  503: t("errors.UPSTREAM_UNAVAILABLE"),
  504: t("errors.UPSTREAM_TIMEOUT"),
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
  /** English server text. Logged, never rendered. */
  message?: string;
  details?: { fields?: Record<string, string | string[]> } & Record<string, unknown>;
  retryAfter?: number;
};

/**
 * Backend code → Arabic copy. An unknown code falls back to the status-specific
 * line, so a new server-side code degrades to useful guidance rather than
 * leaking English or showing a blank toast.
 */
export function toArabicError(code: string | undefined, status?: number): string {
  if (status === 429) return AR_ERROR_MAP.RATE_LIMITED_429;
  if (code && AR_ERROR_MAP[code]) return AR_ERROR_MAP[code];
  if (status && UNKNOWN_BY_STATUS[status]) return UNKNOWN_BY_STATUS[status];
  if (!code) return AR_ERROR_MAP.UNKNOWN;
  return AR_ERROR_MAP.UNKNOWN;
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
