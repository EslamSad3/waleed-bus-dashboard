# Copy deck — Egyptian Arabic (P0 scope + P1 additions)

Authored in P0 per PRD §10. Western digits in tables; Arabic labels everywhere.
Backend codes map via `lib/errors.ts` (see `specs/000-p0-scaffold/contracts/error-map.ar-EG.json`).

## Login (`(auth)/login`)

- Title: تسجيل الدخول
- Subtitle: لوحة تحكم المشرف العام — منصة الأتوبيسات
- Email label: البريد الإلكتروني
- Password label: كلمة السر
- Show password: إظهار كلمة السر / Hide: إخفاء كلمة السر
- Remember me: تذكرني
- Submit: دخول / Submitting: جاري الدخول…
- Invalid email: اكتب بريد إلكتروني صحيح
- Short password: كلمة السر لازم تبقى 8 حروف على الأقل
- Failed (generic): بيانات الدخول غير صحيحة
- Throttled (429): محاولات كتير، حاول بعد شوية
- Unreachable: مشكلة في الاتصال بالسيرفر

## Shell

- App name: منصة الأتوبيسات
- Session label: حساب المشرف (falls back to مشرف عام)
- Sign out: خروج / Signing out: جاري الخروج…
- Nav: نظرة عامة، الأساطيل، الأتوبيسات، الرحلات، الحجوزات، السواقين والملاك، المستخدمين، الأدوار والصلاحيات، التقارير، سجل التدقيق، الإعدادات
- Footer: منصة الأتوبيسات — لوحة تحكم المشرف العام
- Loading: جاري التحميل

## Overview skeleton

- Headline: لوحة تحكم منصة الأتوبيسات
- Sub: إدارة الأساطيل والأتوبيسات والرحلات والحجوزات من مكان واحد
- KPIs: الأساطيل، الأتوبيسات، رحلات شغالة، حجوزات النهاردة
- CTA band: ابدأ من هنا / التقارير والملخصات بتتولد PDF بالعربي من صفحة التقارير / التقارير / الأساطيل

## P1 shared (T008)

- Fleet scope: الأسطول / اختار الأسطول / اختار الأسطول الأول (x-fleet-id)
- List: عرض المزيد / جاري التحميل… / لا توجد عناصر بعد — ابدأ بإضافة جديد
- Confirm delete: تأكيد المسح — الإجراء ده مينفعش يتراجع / مسح / إلغاء
- Roster warning: الإجراء ده هيقفل جلسات المستخدم فورا — متأكد؟ / تأكيد / إلغاء
- Saved: اتحفظ بنجاح / Created: اتضاف بنجاح / Deleted: اتمسح بنجاح
- In-form fleet picker: الأسطول / اختار الأسطول
- Driver picker: اختار السواق / اختار السواق الأول
- Optional role: دور المالك الابتدائي غير صحيح / Role: اختار الدور

## Fleets (US1)

- Title: الأساطيل / New: أسطول جديد / Search: دور باسم الأسطول / Filter: الحالة (الكل/نشط/موقوف)
- Fields: اسم الأسطول / المالك / اختار المالك / دور المالك الابتدائي (اختياري) / نشط
- Tabs: نظرة عامة / الأتوبيسات / الرحلات / الأعضاء / الحجوزات / التقارير
- Referenced guard: الأسطول مرتبط بأتوبيسات أو رحلات أو حجوزات و مينفعش يتمسح
- Owner link failure: مشكلة في ربط مالك الأسطول، راجع بيانات المالك

## Buses (US2)

- Title: الأتوبيسات / New: أتوبيس جديد / Trips tab: رحلات الأتوبيس
- Fields: رقم التسجيل / رقم اللوحة / السعة / الحالة / السواق الحالي
- Duplicate: رقم التسجيل مستخدم قبل كده
- Disable: إيقاف / Reactivate: إعادة تشغيل / Blocked: العملية مرفوضة: الأتوبيس عليه رحلة شغالة (DEPARTED)
- Assign: تعيين سواق / Unassign: إلغاء التعيين / Re-assign same: السواق متعين على الأتوبيس ده قبل كده
- Driver failure: تعيين السواق مرفوض: مش نشط أو من أسطول تاني

## Trips (US3)

- Title: الرحلات / New: رحلة جديدة
- Filters: الحالة / من (origin search) / إلى (destination search) / من تاريخ / إلى تاريخ
- Fields: من / إلى / ميعاد المغادرة / الأتوبيس / الحالة (مجدولة/شغالة/خلصت/ملغية)
- Statuses: SCHEDULED=مجدولة / DEPARTED=شغالة / COMPLETED=خلصت / CANCELLED=ملغية
- Cancel: إلغاء الرحلة / Detail links: كشف الحجوزات

## Bookings (US4)

- Title: الحجوزات / New: حجز جديد
- Filters: الرحلة / الحالة / الدفع / بحث باسم الراكب أو موبايله
- Fields: اسم الراكب / موبايل الراكب / عدد الكراسي / الحالة (مؤكد/ملغي) / الدفع
- Booking statuses: CONFIRMED=مؤكد / CANCELLED=ملغي
- Cancel: إلغاء الحجز

## Members + drivers (US5)

- Members tab: أعضاء الأسطول / Add: إضافة عضو / اختار المستخدم / الدور / الحالة
- Duplicate member: المستخدم ده عضو في الأسطول ده قبل كده
- Statuses: ACTIVE=نشط / SUSPENDED=موقوف / REVOKED=ملغي الصلاحية
- Roster: السواقين / Invite: دعوة سواق / existing: من مستخدم موجود / fresh: بيانات جديدة (اسم+موبايل+كلمة سر)
- History: سجل التعيينات (نشط/منتهي)
