"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  sendPlatformNotification,
  type SendNotificationInput,
} from "@/lib/actions/notifications";
import { fetchTargetOptions, type TargetOption } from "@/lib/actions/users";
import { fetchPromotions, type Promotion } from "@/lib/actions/promotions";
import { fetchTripsPage, type Trip } from "@/lib/actions/trips";
import { fetchFleetsPage } from "@/lib/actions/fleets";
import { AlertCircle, Send, Users, User, Search, Check } from "lucide-react";

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

  // Dropdown data options
  const [userOptions, setUserOptions] = useState<TargetOption[]>([]);
  const [userSearch, setUserSearch] = useState("");

  const [promotions, setPromotions] = useState<Promotion[]>([]);

  const [trips, setTrips] = useState<Trip[]>([]);

  // Load users when dialog is opened in single-user mode
  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(() => {
      fetchTargetOptions(userSearch).then((res) => {
        if (active && res.ok) setUserOptions(res.data);
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, userSearch]);

  // Load promotions when category is DISCOUNT_CODE
  useEffect(() => {
    if (!open || category !== "DISCOUNT_CODE") return;
    if (promotions.length > 0) return;
    let active = true;
    fetchPromotions().then((res) => {
      if (active && res.ok) {
        setPromotions(res.data.items.filter((p) => p.isActive));
      }
    });
    return () => {
      active = false;
    };
  }, [open, category, promotions.length]);

  // Load trips when category is TRIP
  useEffect(() => {
    if (!open || category !== "TRIP") return;
    if (trips.length > 0) return;
    let active = true;
    fetchFleetsPage(null).then(async (fleetsRes) => {
      if (active && fleetsRes.ok) {
        const collected: Trip[] = [];
        for (const fleet of fleetsRes.data.items.slice(0, 5)) {
          const tRes = await fetchTripsPage(fleet.id, null);
          if (tRes.ok) collected.push(...tRes.data.items);
        }
        if (active) setTrips(collected);
      }
    });
    return () => {
      active = false;
    };
  }, [open, category, trips.length]);

  function resetForm() {
    setIsGlobal(true);
    setUserId("");
    setUserSearch("");
    setCategory("TEXT");
    setTitle("");
    setBody("");
    setTripId("");
    setPromotionId("");
    setError(null);
  }

  const selectedUser = userOptions.find((u) => u.id === userId);

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
    if (!isGlobal && !userId) {
      setError("يرجى اختيار المستخدم المستهدف من القائمة أو اختيار إرسال عام");
      return;
    }
    if (category === "TRIP" && !tripId) {
      setError("يرجى اختيار الرحلة من القائمة");
      return;
    }
    if (category === "DISCOUNT_CODE" && !promotionId) {
      setError("يرجى اختيار كود الخصم من القائمة");
      return;
    }

    setSubmitting(true);

    const payload: SendNotificationInput = {
      isGlobal,
      userId: isGlobal ? undefined : userId,
      category,
      title: trimmedTitle,
      body: trimmedBody,
      tripId: category === "TRIP" ? tripId : undefined,
      promotionId: category === "DISCOUNT_CODE" ? promotionId : undefined,
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

        {/* User Selection Dropdown (NO UUID) */}
        {!isGlobal && (
          <div className="space-y-2 rounded-xl border border-[#daeaf5] bg-[#f8fbfd] p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#10153c]">اختر المستخدم المستهدف *</label>
            </div>

            {/* Quick search input to filter users */}
            <div className="relative">
              <Input
                placeholder="ابحث بالاسم، رقم الموبايل، أو البريد لتصفية القائمة…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="text-xs pe-8"
              />
              <Search className="size-3.5 absolute left-2.5 top-3 text-[#5e6b78] pointer-events-none" />
            </div>

            {/* User Dropdown */}
            <select
              className="w-full rounded-xl border border-[#d7e1ea] bg-white p-2.5 text-sm outline-none focus:border-[#2f719e] focus:ring-1 focus:ring-[#2f719e]"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">-- اختر المستخدم من القائمة ({userOptions.length} متاح) --</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || "مستخدم بدون اسم"} {u.phoneNumber ? `(${u.phoneNumber})` : ""}{" "}
                  {u.email ? `— ${u.email}` : ""}
                </option>
              ))}
            </select>

            {/* Selected User Confirmation Badge */}
            {selectedUser && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-900">
                <Check className="size-4 text-emerald-600 shrink-0" />
                <div className="flex flex-wrap gap-x-2">
                  <span className="font-bold">{selectedUser.name || "مستخدم"}</span>
                  {selectedUser.phoneNumber && (
                    <span dir="ltr" className="text-emerald-700">
                      {selectedUser.phoneNumber}
                    </span>
                  )}
                  {selectedUser.email && (
                    <span dir="ltr" className="text-emerald-600">
                      {selectedUser.email}
                    </span>
                  )}
                </div>
              </div>
            )}
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

        {/* Trip Dropdown if TRIP (NO UUID) */}
        {category === "TRIP" && (
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#10153c]">اختر الرحلة *</label>
            <select
              className="w-full rounded-xl border border-[#d7e1ea] bg-white p-2.5 text-sm outline-none focus:border-[#2f719e] focus:ring-1 focus:ring-[#2f719e]"
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
            >
              <option value="">-- اختر الرحلة من القائمة --</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.origin} ← {t.destination} ({new Date(t.departAt).toLocaleString("ar-EG")})
                </option>
              ))}
            </select>
            {trips.length === 0 && (
              <p className="text-[11px] text-amber-700">لا توجد رحلات مجدولة حاليًا في النظام.</p>
            )}
          </div>
        )}

        {/* Promotion Dropdown if DISCOUNT_CODE (NO UUID) */}
        {category === "DISCOUNT_CODE" && (
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#10153c]">اختر كود الخصم *</label>
            <select
              className="w-full rounded-xl border border-[#d7e1ea] bg-white p-2.5 text-sm outline-none focus:border-[#2f719e] focus:ring-1 focus:ring-[#2f719e]"
              value={promotionId}
              onChange={(e) => setPromotionId(e.target.value)}
            >
              <option value="">-- اختر كود الخصم من القائمة --</option>
              {promotions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — خصم {p.value} جنيه ({p.isGlobal ? "كود عام" : "كود مخصص"})
                </option>
              ))}
            </select>
            {promotions.length === 0 && (
              <p className="text-[11px] text-amber-700">لا توجد أكواد خصم نشطة حاليًا في النظام.</p>
            )}
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
