"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import { fetchBookingsPage, BOOKING_STATUS_AR, type Booking } from "@/lib/actions/bookings";
import { useFilterStore } from "@/stores/filters";

export default function BookingsPage() {
  const { fleetId, listFilters, setListFilter } = useFilterStore();
  const [first, setFirst] = useState<{ key: string; items: Booking[]; nextCursor: string | null } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  const f = listFilters["bookings"] ?? {};

  useEffect(() => {
    if (!fleetId) return;
    fetchBookingsPage(fleetId, null).then((r) => {
      if (r.ok) setFirst({ key: fleetId, items: r.data.items, nextCursor: r.data.nextCursor });
      else setFailed({ key: fleetId, message: r.message });
    });
  }, [fleetId]);

  const loading = !first || first.key !== fleetId;
  const showFailed = failed && failed.key === fleetId ? failed.message : null;

  const q = (f.q ?? "").trim();
  const status = f.status ?? "all";
  const predicate = (b: Booking) =>
    (!q || b.passengerName.includes(q) || (b.passengerPhone ?? "").includes(q)) &&
    (status === "all" || b.status === status);

  if (!fleetId) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="title-grad text-2xl font-extrabold">الحجوزات</h1>
        <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-[#606060]">اختار الأسطول الأول (x-fleet-id)</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="title-grad text-2xl font-extrabold">الحجوزات</h1>
        <Button asChild>
          <Link href="/bookings/new">حجز جديد</Link>
        </Button>
      </div>

      {showFailed ? (
        <p role="alert" className="text-sm text-red-600">{showFailed}</p>
      ) : loading || !first ? (
        <p className="text-sm text-[#606060]">جاري التحميل…</p>
      ) : (
        <CursorList<Booking>
          key={fleetId}
          initialItems={first.items}
          initialCursor={first.nextCursor}
          loadMore={(cursor) =>
            fetchBookingsPage(fleetId, cursor).then((r) => {
              if (!r.ok) throw new Error(r.message);
              return { items: r.data.items, nextCursor: r.data.nextCursor };
            })
          }
          keyOf={(b) => b.id}
          filter={predicate}
          filterBar={
            <div className="flex flex-wrap gap-2">
              <Input
                aria-label="بحث باسم الراكب أو موبايله"
                placeholder="بحث باسم الراكب أو موبايله"
                value={f.q ?? ""}
                onChange={(e) => setListFilter("bookings", { q: e.target.value })}
                className="max-w-xs bg-white"
              />
              <select
                aria-label="الحالة"
                value={status}
                onChange={(e) => setListFilter("bookings", { status: e.target.value })}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">كل الحالات</option>
                <option value="CONFIRMED">مؤكد</option>
                <option value="CANCELLED">ملغي</option>
              </select>
            </div>
          }
          emptyMessage="لا توجد حجوزات في الأسطول ده — ابدأ بإضافة جديد"
          renderItem={(b) => (
            <Link
              href={`/bookings/${b.id}`}
              className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow transition-colors hover:bg-[#daeaf5]"
            >
              <span className="font-semibold text-[#1a1a1a]">
                {b.passengerName}
                {b.passengerPhone ? <span className="text-sm text-[#606060]"> · <span dir="ltr">{b.passengerPhone}</span></span> : null}
              </span>
              <span className="text-sm text-[#606060]">
                كراسي <span dir="ltr">{b.seats}</span> · {BOOKING_STATUS_AR[b.status]}
              </span>
            </Link>
          )}
        />
      )}
    </div>
  );
}
