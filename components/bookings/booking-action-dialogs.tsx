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
      setError("رقم المعاملة الخارجية مطلوب");
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("المبلغ لازم يكون رقماً موجباً");
      return;
    }
    if (mismatch) {
      setError(`المبلغ المدخل (${amount}) غير مطابق لقيمة الحجز بالظبط (${booking.totalAmount} ج.م)`);
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
      onSuccess("تم تأكيد وتوثيق استلام الدفع بنجاح");
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="تأكيد وتسوية الدفع الإلكتروني / المحفظة"
      description={`توثيق استلام المبلغ للحجز #${booking.id.slice(0, 8)} للمسافر ${booking.passenger?.name ?? "—"}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-xl border border-[#daeaf5] bg-[#f8fbfd] p-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-[#5e6b78]">قيمة الحجز الإجمالية:</span>
            <span className="font-bold text-[#10153c] text-base" dir="ltr">{booking.totalAmount} EGP</span>
          </div>
          <p className="mt-1 text-xs text-[#5e6b78]">
            تنبيه: يتطلب النظام مطابقة المبلغ المسدد بالكامل مع إجمالي الحجز (Exact Match).
          </p>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">رقم المعاملة / المرجع الخارجي *</span>
          <Input
            placeholder="مثال: VF-9021849 أو رقم إيصال إنستاباي"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            dir="ltr"
            required
            autoFocus
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">المبلغ المستلم المؤكد (ج.م) *</span>
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
              تنبيه: المبلغ المدخل لا يطابق قيمة الحجز ({booking.totalAmount} ج.م)
            </p>
          )}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">طريقة الدفع</span>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="select-field w-full"
          >
            <option value="VODAFONE_CASH">فودافون كاش (Vodafone Cash)</option>
            <option value="INSTAPAY">إنستاباي (InstaPay)</option>
            <option value="WALLET">محفظة إلكترونية أخرى</option>
            <option value="CASH">نقدي (كاش)</option>
            <option value="CARD">بطاقة بنكية</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">ملاحظات التسوية (اختياري)</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="مثلاً: تم التأكد من كشف حساب محفظة التاجر بتاريخ اليوم"
            className="w-full rounded-xl border border-[#d8e4ec] bg-white p-3 text-sm text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f719e]"
          />
        </label>

        <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-[#e4ecf2]">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            إلغاء
          </Button>
          <Button type="submit" disabled={loading || mismatch} className="gap-1.5">
            <CheckCircle2 className="size-4" />
            {loading ? "جاري التأكيد…" : "تأكيد واستلام الدفع"}
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
      setError("سبب تسجيل فشل الدفع إلزامي");
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
      onSuccess("تم تسجيل العملية كفاشلة وتحديث حالة الدفع إلى FAILED");
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="تسجيل فشل الدفع / إلغاء المعاملة"
      description="استخدم هذا الإجراء في حال عدم العثور على التحويل، أو تقديم بيانات وهمية أو انتهاء مهلة السداد."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">سبب الفشل / الرفض *</span>
          <Input
            placeholder="مثال: لم يتم العثور على رقم العملية في كشف الحساب بعد انقضاء المهلة"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">ملاحظات إضافية (اختياري)</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="تفاصيل المحادثة مع العميل أو تتبع كشف الحساب"
            className="w-full rounded-xl border border-[#d8e4ec] bg-white p-3 text-sm text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f719e]"
          />
        </label>

        <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-[#e4ecf2]">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            إلغاء
          </Button>
          <Button type="submit" variant="destructive" disabled={loading} className="gap-1.5">
            <XCircle className="size-4" />
            {loading ? "جاري التسجيل…" : "تسجيل فشل الدفع"}
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
      setError("رقم إشعار أو مرجع الاسترداد مطلوب");
      return;
    }
    if (isNaN(enteredAmount) || enteredAmount <= 0) {
      setError("مبلغ الاسترداد لازم يكون رقماً موجباً");
      return;
    }
    if (exceeds) {
      setError(`مبلغ الاسترداد (${enteredAmount}) يتجاوز الرصيد المتبقي القابل للاسترداد (${remaining.toFixed(2)} ج.م)`);
      return;
    }
    if (!reason.trim()) {
      setError("سبب الاسترداد إلزامي");
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
      onSuccess(`تم تسجيل استرداد مبلغ ${enteredAmount} ج.م بنجاح`);
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="استرداد مالي (كلي أو جزئي)"
      description="تسجيل عملية تحويل استرداد المبلغ للمسافر وتحديث رصيد الحجز."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#daeaf5] bg-[#f8fbfd] p-3 text-xs sm:text-sm">
          <div>
            <span className="text-[#5e6b78] block">إجمالي الحجز:</span>
            <span className="font-bold text-[#10153c]" dir="ltr">{booking.totalAmount} EGP</span>
          </div>
          <div>
            <span className="text-[#5e6b78] block">المسترد سابقاً:</span>
            <span className="font-bold text-[#e16800]" dir="ltr">{booking.refundedAmount} EGP</span>
          </div>
          <div>
            <span className="text-[#5e6b78] block">الرصيد المتبقي:</span>
            <span className="font-bold text-green-700" dir="ltr">{remaining.toFixed(2)} EGP</span>
          </div>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">رقم إشعار التحويل / المرجع البنكي *</span>
          <Input
            placeholder="مثال: REF-VF-10928"
            value={refundReference}
            onChange={(e) => setRefundReference(e.target.value)}
            dir="ltr"
            required
            autoFocus
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">المبلغ المطلوب استرداده (ج.م) *</span>
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
              المبلغ يتجاوز الرصيد المتبقي ({remaining.toFixed(2)} ج.م)
            </p>
          )}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">سبب الاسترداد *</span>
          <Input
            placeholder="مثال: إلغاء رحلة / إلغاء مقعد بناء على طلب العميل"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">ملاحظات إضافية (اختياري)</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="بيانات الحساب أو المحفظة المحول إليها"
            className="w-full rounded-xl border border-[#d8e4ec] bg-white p-3 text-sm text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f719e]"
          />
        </label>

        <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-[#e4ecf2]">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            إلغاء
          </Button>
          <Button type="submit" disabled={loading || exceeds || remaining <= 0} className="gap-1.5">
            <RotateCcw className="size-4" />
            {loading ? "جاري التنفيذ…" : "تنفيذ الاسترداد"}
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
      setError("سبب الإلغاء الإداري إلزامي");
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
      onSuccess(`تم إلغاء الحجز إدارياً ${res.data.seatsRestored ? "(وتم تحرير المقاعد للرحلة)" : ""}`);
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="إلغاء الحجز إدارياً (Force Cancel)"
      description="إلغاء فوري للحجز من صلاحيات الإدارة العليا مع التحكم في تحرير المقاعد لركاب آخرين."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">سبب الإلغاء الإداري *</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="اكتب التبرير أو سبب الإلغاء بالتفصيل (مطلوب لأغراض سجل التدقيق)..."
            className="w-full rounded-xl border border-[#d8e4ec] bg-white p-3 text-sm text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f719e]"
            required
            autoFocus
          />
        </label>

        <div className="rounded-xl border border-[#daeaf5] bg-[#f8fbfd] p-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={releaseSeats}
              onChange={(e) => setReleaseSeats(e.target.checked)}
              className="mt-1 size-4 rounded text-[#2f719e] focus:ring-[#2f719e]"
            />
            <div className="text-sm">
              <span className="font-semibold text-[#1a1a1a] block">إرجاع المقاعد لسعة الرحلة المتاحة</span>
              <span className="text-xs text-[#5e6b78]">
                إذا كانت الرحلة مجدولة ولم تتحرك بعد، سيتم زيادة المقاعد المتاحة فوراً بمقدار ({booking.seats}) مقعد.
              </span>
            </div>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-[#e4ecf2]">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            تراجع
          </Button>
          <Button type="submit" variant="destructive" disabled={loading} className="gap-1.5">
            <XCircle className="size-4" />
            {loading ? "جاري الإلغاء…" : "تأكيد إلغاء الحجز"}
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
      setError("سبب استرجاع الحجز إلزامي");
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
      onSuccess("تم استرجاع الحجز وتأكيده بنجاح");
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="استرجاع وتأكيد الحجز الملغي"
      description="إعادة تفعيل الحجز المحذوف أو الملغي عن طريق الخطأ بعد التحقق من توفر المقاعد."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 leading-relaxed">
          <p className="font-semibold mb-1">فحص سعة الأتوبيس الفورية:</p>
          المقاعد المطلوبة للحجز: <strong>{booking.seats}</strong> مقعد. سيتحقق السيرفر تلقائياً من توفر السعة في الرحلة، وسيتم رفض العملية إذا كانت الرحلة ممتلئة بالكامل.
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">سبب وتبرير الاسترجاع *</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: الإلغاء تم بالخطأ من العميل وأكد رغبته في السفر..."
            className="w-full rounded-xl border border-[#d8e4ec] bg-white p-3 text-sm text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f719e]"
            required
            autoFocus
          />
        </label>

        <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-[#e4ecf2]">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            إلغاء
          </Button>
          <Button type="submit" disabled={loading} className="gap-1.5">
            <CheckCircle2 className="size-4" />
            {loading ? "جاري الاسترجاع…" : "استرجاع الحجز"}
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
      setError("مبرر التعديل التشغيلي إلزامي لأغراض الرقابة وسجل التدقيق");
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
      onSuccess("تم تحديث الحالة التشغيلية للراكب بنجاح");
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="تعديل الحالة التشغيلية للمسافر (تجاوز إداري)"
      description="تصحيح بيانات الصعود والنزول في حالات انقطاع اتصال تطبيق السائق أو عطل جهازه."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-xl border border-[#daeaf5] bg-[#f8fbfd] p-3 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={boarded}
              onChange={(e) => setBoarded(e.target.checked)}
              className="size-4 rounded text-[#2f719e] focus:ring-[#2f719e]"
            />
            <span className="text-sm font-semibold text-[#1a1a1a]">صعود الراكب (Boarded)</span>
          </label>
          <p className="text-xs text-[#5e6b78] ps-7">
            تحديد هذا الخيار يسجل صعود الراكب في التوقيت الحالي باسم المشرف العام.
          </p>

          <label className="block text-sm pt-2">
            <span className="mb-1 block font-medium text-[#1a1a1a]">حالة النزول (Drop-off Status)</span>
            <select
              value={dropStatus}
              onChange={(e) => setDropStatus(e.target.value as DropStatus | "")}
              className="select-field w-full"
            >
              <option value="">بدون تحديد</option>
              <option value="DROPPED_OFF">تم النزول بنجاح (DROPPED_OFF)</option>
              <option value="NOT_DROPPED_OFF">لم ينزل / تخلف عن النزول (NOT_DROPPED_OFF)</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[#1a1a1a]">معرف محطة النزول (اختياري)</span>
            <Input
              placeholder="مثال: st-auc-gate4"
              value={dropStationId}
              onChange={(e) => setDropStationId(e.target.value)}
              dir="ltr"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[#1a1a1a]">ملاحظة النزول (اختياري)</span>
            <Input
              placeholder="ملاحظة حول مكان أو حالة نزول الراكب"
              value={dropReason}
              onChange={(e) => setDropReason(e.target.value)}
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">التبرير الإداري للتعديل *</span>
          <textarea
            rows={2}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="مثال: تعطل هاتف السائق ونفاد البطارية أثناء خط السير وتم التأكد من صعود الراكب هاتفياً"
            className="w-full rounded-xl border border-[#d8e4ec] bg-white p-3 text-sm text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f719e]"
            required
          />
        </label>

        <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-[#e4ecf2]">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            إلغاء
          </Button>
          <Button type="submit" disabled={loading} className="gap-1.5">
            <CheckCircle2 className="size-4" />
            {loading ? "جاري الحفظ…" : "حفظ التعديل التشغيلي"}
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
      setError("ملاحظات الحل يجب ألا تقل عن 5 أحرف");
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
      onSuccess(status === "RESOLVED" ? "تم حل البلاغ واعتماد الإجراء" : "تم حفظ البلاغ");
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="معالجة بلاغ السائق حول الراكب"
      description="مراجعة مذكرة السائق وتسجيل القرار الإداري النهائي."
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
            <span>مذكرة السائق:</span>
          </div>
          <p className="text-[#1a1a1a] leading-relaxed">{report.note}</p>
          <time className="block text-xs text-[#5e6b78] mt-2" dateTime={report.createdAt}>
            تاريخ التقديم: {new Date(report.createdAt).toLocaleString("ar-EG")}
          </time>
        </div>

        <div className="space-y-2">
          <span className="block text-sm font-medium text-[#1a1a1a]">القرار الإداري *</span>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="report_action"
                value="RESOLVED"
                checked={status === "RESOLVED"}
                onChange={() => setStatus("RESOLVED")}
                className="text-[#2f719e]"
              />
              <span className="font-semibold text-green-800">تم الحل (RESOLVED)</span>
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
              <span className="font-semibold text-slate-700">حفظ البلاغ (DISMISSED)</span>
            </label>
          </div>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1a1a1a]">ملاحظات الحل / قرار المشرف *</span>
          <textarea
            rows={3}
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            placeholder="اكتب تفاصيل التواصل مع الراكب أو السائق والإجراء المتخذ (5 أحرف على الأقل)..."
            className="w-full rounded-xl border border-[#d8e4ec] bg-white p-3 text-sm text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f719e]"
            required
            autoFocus
          />
        </label>

        <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-[#e4ecf2]">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            إلغاء
          </Button>
          <Button type="submit" disabled={loading} className="gap-1.5">
            <CheckCircle2 className="size-4" />
            {loading ? "جاري الحفظ…" : "اعتماد القرار"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
