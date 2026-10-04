import { z } from "zod";
import { t } from "@/lib/i18n/t";

const required = (max: number) => z.string(t("validation.required")).trim().min(1, t("validation.required")).max(max, t("validation.maxLength", { max }));
const optionalText = (max: number) => z.string().max(max, t("validation.maxLength", { max })).optional();
const uuid = z.uuid(t("validation.uuid"));
const password = z.string().min(8, t("validation.passwordMin")).max(128, t("validation.maxLength", { max: 128 }));

export const createUserSchema = z.object({ email: z.email(t("validation.email")).max(255, t("validation.maxLength", { max: 255 })), password, name: optionalText(255), globalRoleSlugs: z.array(required(100)).optional() });
export const updateUserSchema = z.object({ name: optionalText(255), password: password.optional(), isActive: z.boolean().optional(), picture: optionalText(1024), maxBookingSeats: z.number(t("common.validation.seatLimit")).int(t("common.validation.seatLimit")).min(1, t("common.validation.seatLimit")).nullable().optional() });
export const createRoleSchema = z.object({ name: required(100), slug: required(100).min(2, t("validation.invalid")).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, t("validation.invalid")), description: optionalText(500), permissionKeys: z.array(required(100)).min(1, t("validation.permissionsRequired")).optional(), isActive: z.boolean().optional() });
export const updateRoleSchema = createRoleSchema.omit({ slug: true, permissionKeys: true }).partial();
export const userRolesSchema = z.object({ roleSlugs: z.array(required(100)) });
export const rolePermissionsSchema = z.object({ permissionKeys: z.array(required(100)).min(1, t("validation.permissionsRequired")) });

export const notificationSchema = z.object({
  title: required(200), body: required(2000), category: z.enum(["TEXT", "TRIP", "DISCOUNT_CODE"], t("validation.invalid")).optional(),
  isGlobal: z.boolean().optional(), userId: uuid.nullable().optional(), tripId: uuid.nullable().optional(), promotionId: uuid.nullable().optional(),
}).superRefine((value, context) => {
  if (!value.isGlobal && !value.userId) context.addIssue({ code: "custom", path: ["userId"], message: t("notifications.send.errors.targetRequired") });
  if (value.category === "TRIP" && !value.tripId) context.addIssue({ code: "custom", path: ["tripId"], message: t("notifications.send.errors.tripRequired") });
  if (value.category === "DISCOUNT_CODE" && !value.promotionId) context.addIssue({ code: "custom", path: ["promotionId"], message: t("notifications.send.errors.promoRequired") });
});

export const serviceEntrySchema = z.object({ id: uuid.optional(), text: required(200), type: z.enum(["PHONE", "WHATSAPP", "WEBSITE"], t("validation.invalid")), value: required(500), isActive: z.boolean().optional() }).superRefine((value, context) => {
  if (value.type === "WEBSITE") {
    const parsed = z.url().safeParse(value.value);
    if (!parsed.success || !/^https?:\/\//i.test(value.value)) context.addIssue({ code: "custom", path: ["value"], message: t("validation.serviceUrl") });
  } else if (!/^\+?[0-9]{7,15}$/.test(value.value.replace(/[\s-]/g, ""))) context.addIssue({ code: "custom", path: ["value"], message: t("validation.servicePhone") });
});
export const serviceConfigSchema = z.object({ entries: z.array(serviceEntrySchema).max(100, t("validation.serviceRows")) });

const filterDate = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("validation.date")).refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, t("validation.date"))]);
export const dateRangeSchema = z.object({ fromDate: filterDate, toDate: filterDate }).superRefine((value, context) => {
  if (value.fromDate && value.toDate && value.toDate < value.fromDate) context.addIssue({ code: "custom", path: ["toDate"], message: t("validation.dateRange") });
});
