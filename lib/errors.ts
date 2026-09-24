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
  BOOKING_NOT_FOUND: "الحجز مش موجود",
  BOOKING_ALREADY_CANCELLED: "الحجز ملغي بالفعل",
  BOOKING_NOT_CANCELLED: "الحجز غير ملغي، لا يمكن استرجاعه",
  SEATS_UNAVAILABLE: "لا توجد مقاعد كافية في الرحلة لاسترجاع الحجز",
  PAYMENT_AMOUNT_MISMATCH: "المبلغ المدخل غير مطابق لقيمة الحجز بالظبط",
  PAYMENT_ALREADY_SETTLED: "تم تأكيد أو تسوية الدفع للحجز ده مسبقاً",
  REFUND_EXCEEDS_BALANCE: "المبلغ المطلوب استرداده أكبر من الرصيد المتبقي للحجز",
  REFUND_NOT_ELIGIBLE: "الحجز غير مؤهل للاسترداد الإلكتروني (حجز نقدي غير مسدد)",
  REPORT_NOT_FOUND: "البلاغ مش موجود في الحجز ده",
  INVALID_REPORT_STATUS: "حالة البلاغ غير صالحة، لازم تكون محلول أو ملغي",
  INVALID_GOVERNORATE: "المحافظة المختارة غير متاحة",
  INVALID_MARKAZ: "المركز المختار غير متاح",
  INVALID_LOCALITY: "المدينة/القرية المختارة غير متاحة",
  INVALID_GEO_HIERARCHY: "المدينة/القرية لا تنتمي إلى المحافظة المختارة",
  MARKAZ_IN_USE: "المركز مرتبط بمدن/قرى ومينفعش يتمسح — أوقفه بدلًا من ذلك",
  LOCALITY_IN_USE: "المدينة/القرية مرتبطة بنقاط توقف ومينفعش تتمسح — أوقفها بدلًا من ذلك",
  STOP_IN_USE: "نقطة التوقف مستخدمة في خط رحلة ومينفعش تتمسح — أوقفها بدلًا من ذلك",
  INVALID_BRAND: "ماركة الأتوبيس المختارة غير متاحة",
  INVALID_VEHICLE_YEAR: "سنة موديل الأتوبيس غير صالحة",
  VIP_TIER_NOT_AVAILABLE: "مستوى VIP المختار غير متاح",
  FORBIDDEN_PLATFORM_ACCESS: "مفيش صلاحية، العملية تتطلب صلاحيات المشرف العام",
  JUSTIFICATION_REQUIRED: "سبب وتبرير العملية إلزامي",
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
