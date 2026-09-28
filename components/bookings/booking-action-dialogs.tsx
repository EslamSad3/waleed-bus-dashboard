"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  verifyBookingPayment,
  failBookingPayment,
  refundBookingPayment,
  forceCancelBooking,
  reinstateBooking,
  overrideBookingOperational,
  resolveIncidentReport,
  type AdminBookingDetail,
  type IncidentReport,
  type DropStatus,
} from "@/lib/actions/bookings";
import { AlertTriangle, CheckCircle2, RotateCcw, XCircle, ShieldAlert } from "lucide-react";
import { t } from "@/lib/i18n/t";

// ---------------------------------------------------------------------------
// 1. Verify Payment Dialog
// ---------------------------------------------------------------------------
export function VerifyPaymentDialog({
  booking,
  open,
  onOpenChange,
  onSuccess,
}: {
  booking: AdminBookingDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedNote?: string) => void;
}) {
  const [reference, setReference] = useState(booking.paymentReference ?? "");
  const [amount, setAmount] = useState(booking.totalAmount);
  const [paymentMethod, setPaymentMethod] = useState(booking.paymentMethod || "VODAFONE_CASH");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numAmount = Number(amount);
  const expectedAmount = Number(booking.totalAmount);
  const mismatch = !isNaN(numAmount) && !isNaN(expectedAmount) && Math.abs(numAmount - expectedAmount) > 0.001;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim()) {
      setError(t("bookings.actions.errors.referenceRequired"));
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setError(t("bookings.actions.errors.amountPositive"));
      return;
    }
    if (mismatch) {
      setError(t("bookings.actions.errors.amountMismatch", { amount: amount, bookingTotalAmount: booking.totalAmount }));
      return;
    }

    setLoading(true);
    setError(null);
    const res = await verifyBookingPayment(booking.id, {
      reference: reference.trim(),
      amount: numAmount,
      paymentMethod: paymentMethod || undefined,
      notes: notes.trim() || undefined,
    });
    setLoading(false);

    if (res.ok) {
      onOpenChange(false);
      onSuccess(t("bookings.actions.verify.success"));
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("bookings.actions.verify.title")}
      description={t("bookings.actions.verify.description", { value: booking.id.slice(0, 8), value2: booking.passenger?.name ?? "—" })}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-xl border border-[#d6eeff] bg-[#f8fbfd] p-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-[#5e6b78]">{t("bookings.actions.verify.totalLabel")}</span>
            <span className="font-bold text-[#00134c] text-base" dir="ltr">{booking.totalAmount} EGP</span>
          </div>
          <p className="mt-1 text-xs text-[#5e6b78]">
            {t("bookings.actions.verify.exactMatchWarning")}
          </p>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">{t("bookings.actions.verify.referenceLabel")}</span>
          <Input
            placeholder={t("bookings.actions.placeholders.verifyReference")}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            dir="ltr"
            required
            autoFocus
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">{t("bookings.actions.verify.amountLabel")}</span>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            dir="ltr"
            required
          />
          {mismatch && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {t("bookings.actions.verify.amountMismatchWarning")}{booking.totalAmount} {t("common.unit.egpSuffix")}
            </p>
          )}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">{t("common.fields.paymentMethod")}</span>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="select-field w-full"
          >
            <option value="VODAFONE_CASH">{t("enums.paymentMethod.vodafoneCashLong")}</option>
            <option value="INSTAPAY">{t("enums.paymentMethod.instapayLong")}</option>
            <option value="WALLET">{t("enums.paymentMethod.walletLong")}</option>
            <option value="CASH">{t("enums.paymentMethod.cashLong")}</option>
            <option value="CARD">{t("enums.paymentMethod.bankCardLong")}</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">{t("bookings.actions.verify.notesLabel")}</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("bookings.actions.placeholders.verifyNotes")}
            className="w-full rounded-xl border border-[#d8e4ec] bg-white p-3 text-sm text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059ff8]"
          />
        </label>

        <div className="mt-6 flex flex-col-reverse justify-end gap-2 pt-2 border-t border-[#e4ecf2] sm:flex-row">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" loading={loading} disabled={mismatch} className="gap-1.5">
            <CheckCircle2 className="size-4" />
            {loading ? t("common.loading.confirming") : t("bookings.actions.verify.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 2. Fail Payment Dialog
// ---------------------------------------------------------------------------
export function FailPaymentDialog({
  booking,
  open,
  onOpenChange,
  onSuccess,
}: {
  booking: AdminBookingDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedNote?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError(t("bookings.actions.failure.errors.reasonRequired"));
      return;
    }

    setLoading(true);
    setError(null);
    const res = await failBookingPayment(booking.id, {
      reason: reason.trim(),
      notes: notes.trim() || undefined,
    });
    setLoading(false);

    if (res.ok) {
      onOpenChange(false);
      onSuccess(t("bookings.actions.failure.success"));
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("bookings.actions.failure.title")}
      description={t("bookings.actions.failure.description")}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">{t("bookings.actions.failure.reasonLabel")}</span>
          <Input
            placeholder={t("bookings.actions.placeholders.failureReason")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">{t("bookings.actions.failure.extraNotesLabel")}</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("bookings.actions.placeholders.failureNotes")}
            className="w-full rounded-xl border border-[#d8e4ec] bg-white p-3 text-sm text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059ff8]"
          />
        </label>

        <div className="mt-6 flex flex-col-reverse justify-end gap-2 pt-2 border-t border-[#e4ecf2] sm:flex-row">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" variant="destructive" loading={loading} className="gap-1.5">
            <XCircle className="size-4" />
            {loading ? t("common.loading.submitting") : t("bookings.actions.failure.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 3. Refund Payment Dialog
// ---------------------------------------------------------------------------
export function RefundPaymentDialog({
  booking,
  open,
  onOpenChange,
  onSuccess,
}: {
  booking: AdminBookingDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedNote?: string) => void;
}) {
  const total = Number(booking.totalAmount) || 0;
  const refunded = Number(booking.refundedAmount) || 0;
  const remaining = Math.max(0, total - refunded);

  const [refundReference, setRefundReference] = useState("");
  const [refundAmount, setRefundAmount] = useState(remaining > 0 ? remaining.toFixed(2) : "0.00");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enteredAmount = Number(refundAmount);
  const exceeds = enteredAmount > remaining + 0.001;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!refundReference.trim()) {
      setError(t("bookings.actions.refund.errors.referenceRequired"));
      return;
    }
    if (isNaN(enteredAmount) || enteredAmount <= 0) {
      setError(t("bookings.actions.refund.errors.amountPositive"));
      return;
    }
    if (exceeds) {
      setError(t("bookings.actions.refund.errors.exceedsBalance", { enteredAmount: enteredAmount, value: remaining.toFixed(2) }));
      return;
    }
    if (!reason.trim()) {
      setError(t("bookings.actions.refund.errors.reasonRequired"));
      return;
    }

    setLoading(true);
    setError(null);
    const res = await refundBookingPayment(booking.id, {
      refundReference: refundReference.trim(),
      refundAmount: enteredAmount,
      reason: reason.trim(),
      notes: notes.trim() || undefined,
    });
    setLoading(false);

    if (res.ok) {
      onOpenChange(false);
      onSuccess(t("bookings.actions.refund.success", { enteredAmount: enteredAmount }));
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("bookings.actions.refund.title")}
      description={t("bookings.actions.refund.description")}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 rounded-xl border border-[#d6eeff] bg-[#f8fbfd] p-3 text-xs sm:grid-cols-3 sm:text-sm">
          <div>
            <span className="text-[#5e6b78] block">{t("bookings.actions.refund.totalLabel")}</span>
            <span className="font-bold text-[#00134c]" dir="ltr">{booking.totalAmount} EGP</span>
          </div>
          <div>
            <span className="text-[#5e6b78] block">{t("bookings.actions.refund.refundedLabel")}</span>
            <span className="font-bold text-[#e16800]" dir="ltr">{booking.refundedAmount} EGP</span>
          </div>
          <div>
            <span className="text-[#5e6b78] block">{t("bookings.actions.refund.remainingLabel")}</span>
            <span className="font-bold text-green-700" dir="ltr">{remaining.toFixed(2)} EGP</span>
          </div>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">{t("bookings.actions.refund.referenceLabel")}</span>
          <Input
            placeholder={t("bookings.actions.placeholders.refundReference")}
            value={refundReference}
            onChange={(e) => setRefundReference(e.target.value)}
            dir="ltr"
            required
            autoFocus
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">{t("bookings.actions.refund.amountLabel")}</span>
          <Input
            type="number"
            step="0.01"
            max={remaining}
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            dir="ltr"
            required
          />
          {exceeds && (
            <p className="mt-1 text-xs text-red-600 font-medium">
              {t("bookings.actions.refund.exceedsWarning")}{remaining.toFixed(2)} {t("common.unit.egpSuffix")}
            </p>
          )}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">{t("bookings.actions.refund.reasonLabel")}</span>
          <Input
            placeholder={t("bookings.actions.placeholders.refundReason")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">{t("bookings.actions.failure.extraNotesLabel")}</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("bookings.actions.placeholders.refundAccount")}
            className="w-full rounded-xl border border-[#d8e4ec] bg-white p-3 text-sm text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059ff8]"
          />
        </label>

        <div className="mt-6 flex flex-col-reverse justify-end gap-2 pt-2 border-t border-[#e4ecf2] sm:flex-row">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" loading={loading} disabled={exceeds || remaining <= 0} className="gap-1.5">
            <RotateCcw className="size-4" />
            {loading ? t("common.loading.executing") : t("bookings.actions.refund.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 4. Force Cancel Dialog
// ---------------------------------------------------------------------------
export function ForceCancelDialog({
  booking,
  open,
  onOpenChange,
  onSuccess,
}: {
  booking: AdminBookingDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedNote?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [releaseSeats, setReleaseSeats] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError(t("bookings.actions.forceCancel.errors.reasonRequired"));
      return;
    }

    setLoading(true);
    setError(null);
    const res = await forceCancelBooking(booking.id, {
      reason: reason.trim(),
      releaseSeats,
    });
    setLoading(false);

    if (res.ok) {
      onOpenChange(false);
      onSuccess(t("bookings.actions.forceCancel.success", { seatsNote: res.data.seatsRestored ? t("bookings.actions.forceCancel.seatsRestoredNote") : "" }));
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("bookings.actions.forceCancel.title")}
      description={t("bookings.actions.forceCancel.description")}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">{t("bookings.actions.forceCancel.reasonLabel")}</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("bookings.actions.placeholders.forceCancelReason")}
            className="w-full rounded-xl border border-[#d8e4ec] bg-white p-3 text-sm text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059ff8]"
            required
            autoFocus
          />
        </label>

        <div className="rounded-xl border border-[#d6eeff] bg-[#f8fbfd] p-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={releaseSeats}
              onChange={(e) => setReleaseSeats(e.target.checked)}
              className="mt-1 size-4 rounded text-[#059ff8] focus:ring-[#059ff8]"
            />
            <div className="text-sm">
              <span className="font-semibold text-[#1a1a1a] block">{t("bookings.actions.forceCancel.restoreSeats")}</span>
              <span className="text-xs text-[#5e6b78]">
                {t("bookings.actions.reinstate.seatsWarningPrefix")}{booking.seats}{t("bookings.actions.reinstate.seatsWarningSuffix")}
              </span>
            </div>
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse justify-end gap-2 pt-2 border-t border-[#e4ecf2] sm:flex-row">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("bookings.actions.forceCancel.yesLabel")}
          </Button>
          <Button type="submit" variant="destructive" loading={loading} className="gap-1.5">
            <XCircle className="size-4" />
            {loading ? t("common.loading.cancelling") : t("bookings.actions.forceCancel.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 5. Reinstate Booking Dialog
// ---------------------------------------------------------------------------
export function ReinstateDialog({
  booking,
  open,
  onOpenChange,
  onSuccess,
}: {
  booking: AdminBookingDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedNote?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError(t("bookings.actions.reinstate.errors.reasonRequired"));
      return;
    }

    setLoading(true);
    setError(null);
    const res = await reinstateBooking(booking.id, {
      reason: reason.trim(),
    });
    setLoading(false);

    if (res.ok) {
      onOpenChange(false);
      onSuccess(t("bookings.actions.reinstate.success"));
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("bookings.actions.reinstate.title")}
      description={t("bookings.actions.reinstate.description")}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 leading-relaxed">
          <p className="font-semibold mb-1">{t("bookings.actions.reinstate.capacityCheck")}</p>
          {t("bookings.actions.reinstate.seatsRequested")} <strong>{booking.seats}</strong> {t("bookings.actions.reinstate.seatsWarning")}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">{t("bookings.actions.reinstate.reasonLabel")}</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("bookings.actions.placeholders.reinstateReason")}
            className="w-full rounded-xl border border-[#d8e4ec] bg-white p-3 text-sm text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059ff8]"
            required
            autoFocus
          />
        </label>

        <div className="mt-6 flex flex-col-reverse justify-end gap-2 pt-2 border-t border-[#e4ecf2] sm:flex-row">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" loading={loading} className="gap-1.5">
            <CheckCircle2 className="size-4" />
            {loading ? t("common.loading.reinstating") : t("bookings.actions.reinstate.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 6. Operational Override Dialog
// ---------------------------------------------------------------------------
export function OperationalOverrideDialog({
  booking,
  open,
  onOpenChange,
  onSuccess,
}: {
  booking: AdminBookingDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedNote?: string) => void;
}) {
  const [boarded, setBoarded] = useState(Boolean(booking.boardedAt));
  const [dropStatus, setDropStatus] = useState<DropStatus | "">(booking.dropStatus ?? "");
  const [dropStationId, setDropStationId] = useState(booking.dropStationId ?? "");
  const [dropReason, setDropReason] = useState(booking.dropReason ?? "");
  const [justification, setJustification] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!justification.trim()) {
      setError(t("bookings.actions.override.errors.justificationRequired"));
      return;
    }

    setLoading(true);
    setError(null);
    const res = await overrideBookingOperational(booking.id, {
      boarded,
      dropStatus: dropStatus ? (dropStatus as DropStatus) : undefined,
      dropStationId: dropStationId.trim() || undefined,
      dropReason: dropReason.trim() || undefined,
      justification: justification.trim(),
    });
    setLoading(false);

    if (res.ok) {
      onOpenChange(false);
      onSuccess(t("bookings.actions.override.success"));
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("bookings.actions.override.title")}
      description={t("bookings.actions.override.description")}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-xl border border-[#d6eeff] bg-[#f8fbfd] p-3 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={boarded}
              onChange={(e) => setBoarded(e.target.checked)}
              className="size-4 rounded text-[#059ff8] focus:ring-[#059ff8]"
            />
            <span className="text-sm font-semibold text-[#1a1a1a]">{t("bookings.actions.override.boardedLabel")}</span>
          </label>
          <p className="text-xs text-[#5e6b78] ps-7">
            {t("bookings.actions.override.boardedHint")}
          </p>

          <label className="block text-sm pt-2">
            <span className="mb-1 block font-medium text-[#1a1a1a]">{t("bookings.actions.override.dropStatusLabel")}</span>
            <select
              value={dropStatus}
              onChange={(e) => setDropStatus(e.target.value as DropStatus | "")}
              className="select-field w-full"
            >
              <option value="">{t("bookings.actions.override.noDropStatus")}</option>
              <option value="DROPPED_OFF">{t("bookings.actions.override.droppedOff")}</option>
              <option value="NOT_DROPPED_OFF">{t("bookings.actions.override.notDroppedOff")}</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[#1a1a1a]">{t("bookings.actions.override.dropStationLabel")}</span>
            <Input
              placeholder={t("bookings.actions.placeholders.dropStation")}
              value={dropStationId}
              onChange={(e) => setDropStationId(e.target.value)}
              dir="ltr"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[#1a1a1a]">{t("bookings.actions.override.dropNoteLabel")}</span>
            <Input
              placeholder={t("bookings.actions.placeholders.dropNote")}
              value={dropReason}
              onChange={(e) => setDropReason(e.target.value)}
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">{t("bookings.actions.override.justificationLabel")}</span>
          <textarea
            rows={2}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder={t("bookings.actions.placeholders.overrideJustification")}
            className="w-full rounded-xl border border-[#d8e4ec] bg-white p-3 text-sm text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059ff8]"
            required
          />
        </label>

        <div className="mt-6 flex flex-col-reverse justify-end gap-2 pt-2 border-t border-[#e4ecf2] sm:flex-row">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" loading={loading} className="gap-1.5">
            <CheckCircle2 className="size-4" />
            {loading ? t("common.loading.saving") : t("bookings.actions.override.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 7. Resolve Report Dialog
// ---------------------------------------------------------------------------
export function ResolveReportDialog({
  bookingId,
  report,
  open,
  onOpenChange,
  onSuccess,
}: {
  bookingId: string;
  report: IncidentReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedNote?: string) => void;
}) {
  const [status, setStatus] = useState<"RESOLVED" | "DISMISSED">("RESOLVED");
  const [resolutionNote, setResolutionNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!report) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolutionNote.trim() || resolutionNote.trim().length < 5) {
      setError(t("bookings.actions.report.errors.notesTooShort"));
      return;
    }

    setLoading(true);
    setError(null);
    const res = await resolveIncidentReport(bookingId, report!.id, {
      status,
      resolutionNote: resolutionNote.trim(),
    });
    setLoading(false);

    if (res.ok) {
      onOpenChange(false);
      onSuccess(status === "RESOLVED" ? t("bookings.actions.report.resolvedSuccess") : t("bookings.actions.report.savedSuccess"));
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("bookings.actions.report.title")}
      description={t("bookings.actions.report.description")}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm">
          <div className="flex items-center gap-2 font-bold text-amber-900 mb-1">
            <ShieldAlert className="size-4 text-amber-700" />
            <span>{t("bookings.detail.fields.driverNote")}</span>
          </div>
          <p className="text-[#1a1a1a] leading-relaxed">{report.note}</p>
          <time className="block text-xs text-[#5e6b78] mt-2" dateTime={report.createdAt}>
            {t("bookings.detail.reports.submittedAt")} {new Date(report.createdAt).toLocaleString("ar-EG")}
          </time>
        </div>

        <div className="space-y-2">
          <span className="block text-sm font-medium text-[#1a1a1a]">{t("bookings.actions.report.decisionLabel")}</span>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="report_action"
                value="RESOLVED"
                checked={status === "RESOLVED"}
                onChange={() => setStatus("RESOLVED")}
                className="text-[#059ff8]"
              />
              <span className="font-semibold text-green-800">{t("bookings.actions.report.resolvedLabel")}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="report_action"
                value="DISMISSED"
                checked={status === "DISMISSED"}
                onChange={() => setStatus("DISMISSED")}
                className="text-slate-600"
              />
              <span className="font-semibold text-slate-700">{t("bookings.actions.report.dismissedLabel")}</span>
            </label>
          </div>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">{t("bookings.actions.report.notesLabel")}</span>
          <textarea
            rows={3}
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            placeholder={t("bookings.actions.placeholders.reportNotes")}
            className="w-full rounded-xl border border-[#d8e4ec] bg-white p-3 text-sm text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059ff8]"
            required
            autoFocus
          />
        </label>

        <div className="mt-6 flex flex-col-reverse justify-end gap-2 pt-2 border-t border-[#e4ecf2] sm:flex-row">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" loading={loading} className="gap-1.5">
            <CheckCircle2 className="size-4" />
            {loading ? t("common.loading.saving") : t("bookings.actions.report.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
