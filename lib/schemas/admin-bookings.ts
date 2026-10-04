import { z } from "zod";
import { t } from "@/lib/i18n/t";

export const adminVerifyPaymentSchema = z.object({
  /** Optional: cash collections have no transaction id. */
  reference: z.string().max(100, t("validation.transactionRefMax")).optional(),
  amount: z
    .number()
    .positive(t("validation.amountPositive"))
    .multipleOf(0.01, t("validation.moneyPrecision")),
  paymentMethod: z
    .string()
    .max(20, t("validation.paymentMethodMax"))
    .optional(),
  notes: z
    .string()
    .max(500, t("validation.notesMax"))
    .optional(),
});

export const adminFailPaymentSchema = z.object({
  reason: z
    .string()
    .min(1, t("validation.failureReasonRequired"))
    .max(500, t("validation.failureReasonMax")),
  notes: z
    .string()
    .max(500, t("validation.notesMax"))
    .optional(),
});

export const adminRefundPaymentSchema = z.object({
  refundReference: z
    .string()
    .min(1, t("validation.refundRefRequired"))
    .max(100, t("validation.refundRefMax")),
  refundAmount: z
    .number()
    .positive(t("validation.refundAmountPositive"))
    .multipleOf(0.01, t("validation.moneyPrecision")),
  reason: z
    .string()
    .min(1, t("validation.refundReasonRequired"))
    .max(500, t("validation.refundReasonMax")),
  notes: z
    .string()
    .max(500, t("validation.notesMax"))
    .optional(),
});

export const adminForceCancelSchema = z.object({
  reason: z
    .string()
    .min(1, t("validation.forceCancelReasonRequired")),
});

export const adminReinstateSchema = z.object({
  reason: z
    .string()
    .min(1, t("validation.reinstateReasonRequired")),
});

export const adminOperationalOverrideSchema = z.object({
  boarded: z.boolean().optional(),
  dropStatus: z.enum(["DROPPED_OFF", "NOT_DROPPED_OFF"]).optional(),
  dropStationId: z.string().optional(),
  dropReason: z.string().optional(),
  justification: z
    .string()
    .min(1, t("validation.overrideJustificationRequired")),
});

export const adminResolveReportSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"]),
  resolutionNote: z
    .string()
    .min(5, t("validation.reportNotesMin"))
    .max(2000, t("validation.reportNotesMax")),
});

export type AdminVerifyPaymentInput = z.infer<typeof adminVerifyPaymentSchema>;
export type AdminFailPaymentInput = z.infer<typeof adminFailPaymentSchema>;
export type AdminRefundPaymentInput = z.infer<typeof adminRefundPaymentSchema>;
export type AdminForceCancelInput = z.infer<typeof adminForceCancelSchema>;
export type AdminReinstateInput = z.infer<typeof adminReinstateSchema>;
export type AdminOperationalOverrideInput = z.infer<typeof adminOperationalOverrideSchema>;
export type AdminResolveReportInput = z.infer<typeof adminResolveReportSchema>;
