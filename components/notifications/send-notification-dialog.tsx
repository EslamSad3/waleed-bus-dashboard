"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  sendPlatformNotification,
  type SendNotificationInput,
} from "@/lib/actions/notifications";
import { AlertCircle, Send, Users, User, Bell } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (message?: string) => void;
};

export function SendNotificationDialog({ open, onOpenChange, onSuccess }: Props) {
  const [isGlobal, setIsGlobal] = useState(true);
  const [userId, setUserId] = useState("");
  const [category, setCategory] = useState<"TEXT" | "TRIP" | "DISCOUNT_CODE">("TEXT");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tripId, setTripId] = useState("");
  const [promotionId, setPromotionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setIsGlobal(true);
    setUserId("");
    setCategory("TEXT");
    setTitle("");
    setBody("");
    setTripId("");
    setPromotionId("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle) {
      setError("يرجى إدخال عنوان الإشعار");
      return;
    }
    if (!trimmedBody) {
      setError("يرجى إدخال محتوى الإشعار");
      return;
    }
    if (!isGlobal && !userId.trim()) {
      setError("يرجى إدخال معرف المستخدم (UUID) أو اختيار إرسال عام");
      return;
    }
    if (category === "TRIP" && !tripId.trim()) {
      setError("يرجى إدخال معرف الرحلة (UUID)");
      return;
    }
    if (category === "DISCOUNT_CODE" && !promotionId.trim()) {
      setError("يرجى إدخال معرف كود الخصم (UUID)");
      return;
    }

    setSubmitting(true);

    const payload: SendNotificationInput = {
      isGlobal,
      userId: isGlobal ? undefined : userId.trim(),
      category,
      title: trimmedTitle,
      body: trimmedBody,
      tripId: category === "TRIP" ? tripId.trim() : undefined,
      promotionId: category === "DISCOUNT_CODE" ? promotionId.trim() : undefined,
    };

    const res = await sendPlatformNotification(payload);
    setSubmitting(false);

    if (res.ok) {
      const msg = res.data.isGlobal
        ? `تم إرسال الإشعار العام بنجاح إلى ${res.data.sentCount} مستخدم`
        : "تم إرسال الإشعار بنجاح إلى المستخدم المحدد";
      resetForm();
      onOpenChange(false);
      onSuccess(msg);
    } else {
      setError(res.message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
      title="إرسال إشعار جديد"
      description="إرسال إشعار مباشر يظهر في جدول إشعارات المستخدمين وصناديق وارد تطبيقاتهم"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
          >
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Target Mode Toggle */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#10153c]">المستهدفون بالإشعار</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsGlobal(true)}
              className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-colors ${
                isGlobal
                  ? "border-[#2f719e] bg-[#daeaf5] text-[#204c6b]"
                  : "border-[#d7e1ea] bg-white text-[#5e6b78] hover:bg-slate-50"
              }`}
            >
              <Users className="size-4" />
              <span>إشعار عام (لكل المستخدمين)</span>
            </button>
            <button
              type="button"
              onClick={() => setIsGlobal(false)}
              className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-colors ${
                !isGlobal
                  ? "border-[#2f719e] bg-[#daeaf5] text-[#204c6b]"
                  : "border-[#d7e1ea] bg-white text-[#5e6b78] hover:bg-slate-50"
              }`}
            >
              <User className="size-4" />
              <span>مستخدم محدد (فردي)</span>
            </button>
          </div>
        </div>

        {/* User ID input when single user is selected */}
        {!isGlobal && (
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#10153c]">معرف المستخدم (UUID) *</label>
            <Input
              dir="ltr"
              placeholder="مثال: 123e4567-e89b-12d3-a456-426614174000"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-[#5e6b78]">
              يصل الإشعار إلى هذا المستخدم فقط ويظهر فورًا في سجل إشعاراته.
            </p>
          </div>
        )}

        {/* Category select */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#10153c]">نوع الإشعار</label>
          <select
            className="w-full rounded-xl border border-[#d7e1ea] bg-white p-2.5 text-sm outline-none focus:border-[#2f719e] focus:ring-1 focus:ring-[#2f719e]"
            value={category}
            onChange={(e) => setCategory(e.target.value as "TEXT" | "TRIP" | "DISCOUNT_CODE")}
          >
            <option value="TEXT">تنبيه عام (نصي فقط)</option>
            <option value="TRIP">مرتبط برحلة (TRIP)</option>
            <option value="DISCOUNT_CODE">مرتبط بكود خصم (DISCOUNT_CODE)</option>
          </select>
        </div>

        {/* Trip ID if TRIP */}
        {category === "TRIP" && (
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#10153c]">معرف الرحلة (Trip UUID) *</label>
            <Input
              dir="ltr"
              placeholder="UUID الرحلة"
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        )}

        {/* Promotion ID if DISCOUNT_CODE */}
        {category === "DISCOUNT_CODE" && (
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#10153c]">معرف كود الخصم (Promotion UUID) *</label>
            <Input
              dir="ltr"
              placeholder="UUID كود الخصم"
              value={promotionId}
              onChange={(e) => setPromotionId(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        )}

        {/* Title */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#10153c]">عنوان الإشعار *</label>
          <Input
            placeholder="مثال: تنبيه هام بخصوص مواعيد الرحلات"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>

        {/* Body */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#10153c]">نص ومحتوى الإشعار *</label>
          <textarea
            rows={4}
            placeholder="اكتب تفاصيل الإشعار هنا..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            className="w-full rounded-xl border border-[#d7e1ea] bg-white p-2.5 text-sm outline-none focus:border-[#2f719e] focus:ring-1 focus:ring-[#2f719e]"
          />
          <p className="text-left text-[11px] text-[#5e6b78]" dir="ltr">
            {body.length} / 2000
          </p>
        </div>

        {/* Dialog Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-[#e4ecf2] pt-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="gap-2 bg-[#2f719e] hover:bg-[#204c6b]"
          >
            <Send className="size-4" />
            <span>{submitting ? "جاري الإرسال…" : "إرسال الإشعار"}</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
