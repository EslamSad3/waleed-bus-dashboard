"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteBooking, fetchBooking, updateBooking, BOOKING_STATUS_AR, type Booking } from "@/lib/actions/bookings";
import { useFilterStore } from "@/stores/filters";

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const fleetId = useFilterStore((s) => s.fleetId);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fleetId) return;
    const key = `${fleetId}/${id}`;
    fetchBooking(fleetId, id).then((r) => {
      if (r.ok) {
        setBooking(r.data);
        setName(r.data.passengerName);
        setPhone(r.data.passengerPhone ?? "");
        setFailed(null);
      } else setFailed(r.message);
      setLoadedKey(key);
    });
  }, [fleetId, id]);

  function done(ok: boolean, msg: string, updated?: Booking) {
    setError(ok ? null : msg);
    setNote(ok ? msg : null);
    if (ok && updated) setBooking(updated);
  }

  async function save() {
    if (!fleetId) return;
    const r = await updateBooking(fleetId, id, { passengerName: name, passengerPhone: phone || undefined });
    done(r.ok, r.ok ? "اتحفظ بنجاح" : r.message, r.ok ? r.data : undefined);
  }

  async function cancel() {
    if (!fleetId) return;
    if (!window.confirm("تلغي الحجز ده؟")) return;
    const r = await updateBooking(fleetId, id, { status: "CANCELLED" });
    done(r.ok, r.ok ? "اتلغى الحجز" : r.message, r.ok ? r.data : undefined);
  }

  async function remove() {
    if (!fleetId) return;
    if (!window.confirm("تأكيد المسح — الإجراء ده مينفعش يتراجع. تمسح الحجز؟")) return;
    const r = await deleteBooking(fleetId, id);
    if (!r.ok) {
      done(false, r.message);
      return;
    }
    router.push("/bookings");
    router.refresh();
  }

  if (!fleetId) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="title-grad text-2xl font-extrabold">الحجز</h1>
        <p className="empty-state">اختار الأسطول الأول لعرض بيانات الحجز.</p>
      </div>
    );
  }
  if (failed && loadedKey === `${fleetId}/${id}`) return <p role="alert" className="text-sm text-red-600">{failed}</p>;
  if (!booking || loadedKey !== `${fleetId}/${id}`) return <p className="text-sm text-[#606060]">جاري التحميل…</p>;

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div><h1 className="page-title">{booking.passengerName}</h1><p className="page-description">بيانات الراكب والرحلة والدفع وحالة الحجز.</p></div>
        <span className={booking.status === "CONFIRMED" ? "status-pill" : "status-pill status-pill-muted"}>{BOOKING_STATUS_AR[booking.status]}</span>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {note && <p role="status" className="text-sm text-green-700">{note}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel-card p-5 sm:p-6">
          <h2 className="section-title">بيانات الراكب</h2>
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">اسم الراكب</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">موبايل الراكب</span>
              <Input dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <Button type="button" onClick={save}>حفظ</Button>
              <Button type="button" variant="destructive" onClick={remove}>مسح</Button>
            </div>
          </div>
        </div>
        <div className="panel-card p-5 sm:p-6">
          <h2 className="section-title">الرحلة والدفع</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-[#606060]">الرحلة</dt><dd dir="ltr">{booking.tripId.slice(0, 8)}…</dd></div>
            <div className="flex justify-between"><dt className="text-[#606060]">الكراسي</dt><dd dir="ltr">{booking.seats}</dd></div>
            <div className="flex justify-between">
              <dt className="text-[#606060]">تقييم الأتوبيس / السواق</dt>
              <dd dir="ltr">{booking.busRating ?? "—"} / {booking.driverRating ?? "—"}</dd>
            </div>
          </dl>
          <Button type="button" variant="secondary" className="mt-4" onClick={cancel} disabled={booking.status === "CANCELLED"}>
            إلغاء الحجز
          </Button>
        </div>
      </div>
    </div>
  );
}
