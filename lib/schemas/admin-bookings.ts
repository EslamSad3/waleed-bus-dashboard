import { z } from "zod";

export const adminVerifyPaymentSchema = z.object({
  reference: z
    .string()
    .min(1, "رقم المعاملة مطلوب")
    .max(100, "رقم المعاملة بحد أقصى 100 حرف"),
  amount: z
    .number()
    .positive("المبلغ يجب أن يكون رقماً موجباً"),
  paymentMethod: z
    .string()
    .max(20, "طريقة الدفع بحد أقصى 20 حرف")
    .optional(),
  notes: z
    .string()
    .max(500, "الملاحظات بحد أقصى 500 حرف")
    .optional(),
});

export const adminFailPaymentSchema = z.object({
  reason: z
    .string()
    .min(1, "سبب فشل الدفع إلزامي")
    .max(500, "السبب بحد أقصى 500 حرف"),
  notes: z
    .string()
    .max(500, "الملاحظات بحد أقصى 500 حرف")
    .optional(),
});

export const adminRefundPaymentSchema = z.object({
  refundReference: z
    .string()
    .min(1, "رقم إشعار أو مرجع الاسترداد مطلوب")
    .max(100, "رقم المرجع بحد أقصى 100 حرف"),
  refundAmount: z
    .number()
    .positive("مبلغ الاسترداد يجب أن يكون رقماً موجباً"),
  reason: z
    .string()
    .min(1, "سبب الاسترداد إلزامي")
    .max(500, "السبب بحد أقصى 500 حرف"),
  notes: z
    .string()
    .max(500, "الملاحظات بحد أقصى 500 حرف")
    .optional(),
});

export const adminForceCancelSchema = z.object({
  reason: z
    .string()
    .min(1, "سبب إلغاء الحجز إلزامي"),
  releaseSeats: z
    .boolean()
    .optional()
    .default(true),
});

export const adminReinstateSchema = z.object({
  reason: z
    .string()
    .min(1, "سبب استرجاع الحجز إلزامي"),
});

export const adminOperationalOverrideSchema = z.object({
  boarded: z.boolean().optional(),
  dropStatus: z.enum(["DROPPED_OFF", "NOT_DROPPED_OFF"]).optional(),
  dropStationId: z.string().optional(),
  dropReason: z.string().optional(),
  justification: z
    .string()
    .min(1, "تبرير التعديل التشغيلي إلزامي"),
});

export const adminResolveReportSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"]),
  resolutionNote: z
    .string()
    .min(5, "ملاحظات الحل يجب ألا تقل عن 5 أحرف")
    .max(2000, "ملاحظات الحل بحد أقصى 2000 حرف"),
});

export type AdminVerifyPaymentInput = z.infer<typeof adminVerifyPaymentSchema>;
export type AdminFailPaymentInput = z.infer<typeof adminFailPaymentSchema>;
export type AdminRefundPaymentInput = z.infer<typeof adminRefundPaymentSchema>;
export type AdminForceCancelInput = z.infer<typeof adminForceCancelSchema>;
export type AdminReinstateInput = z.infer<typeof adminReinstateSchema>;
export type AdminOperationalOverrideInput = z.infer<typeof adminOperationalOverrideSchema>;
export type AdminResolveReportInput = z.infer<typeof adminResolveReportSchema>;
