/**
 * Backend error-code → Egyptian-Arabic copy (PRD §9 + contracts/error-map.ar-EG.json).
 * Backend failures use generic codes; this map is the ONLY place user-facing
 * Arabic copy is chosen. Unknown codes fall back to a generic message —
 * never leak raw backend messages to the UI.
 */
export const AR_ERROR_MAP: Record<string, string> = {
  AUTHENTICATION_FAILED: "بيانات الدخول غير صحيحة",
  ACCOUNT_ALREADY_EXISTS: "رقم الموبايل أو الرقم القومي مستخدم قبل كده",
  ROLE_CONFIGURATION_INVALID: "إعدادات دور مالك الأسطول غير مكتملة",
  BUS_ACTION_NOT_ALLOWED: "العملية مرفوضة: الأتوبيس عليه رحلة شغالة (DEPARTED)",
  DRIVER_ASSIGNMENT_NOT_ALLOWED: "تعيين السواق مرفوض: مش نشط أو من أسطول تاني",
  RESOURCE_NOT_OWNED: "العنصر مش موجود في الأسطول ده",
  BUS_ACCESS_DENIED: "العنصر مش موجود في الأسطول ده",
  NOT_FOUND: "العنصر غير موجود",
  CONFLICTING_ASSIGNMENT: "البيانات متعارضة مع سجل موجود (راجع الحقول)",
  /** Bare 409s (Prisma P2002/P2003 → codeless ConflictException) mapped per-screen. */
  CONFLICT: "البيانات متعارضة مع سجل موجود (راجع الحقول)",
  VALIDATION_FAILED: "راجع الحقول المطلوبة",
  BAD_REQUEST: "راجع الحقول المطلوبة",
  FORBIDDEN: "مفيش صلاحية للعملية دي",
  MISSING_FLEET_SCOPE: "اختار الأسطول الأول (x-fleet-id)",
  RATE_LIMITED: "محاولات كتير، حاول بعد شوية",
  RATE_LIMITED_429: "محاولات كتير، حاول بعد شوية",
  NETWORK_ERROR: "مشكلة في الاتصال بالسيرفر",
  UNKNOWN: "حصلت مشكلة، حاول تاني",
};

/**
 * Per-screen bare-409 `CONFLICT` messages (research R3). The backend emits
 * codeless 409s for duplicates/references, so the CALLING screen supplies the
 * context — never sniff English backend messages.
 */
export const CONFLICT_MESSAGES = {
  REGISTRATION_TAKEN: "رقم التسجيل مستخدم قبل كده",
  FLEET_REFERENCED: "الأسطول مرتبط بأتوبيسات أو رحلات أو حجوزات و مينفعش يتمسح",
  MEMBER_EXISTS: "المستخدم ده عضو في الأسطول ده قبل كده",
  OWNER_LINK: "مشكلة في ربط مالك الأسطول، راجع بيانات المالك",
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
