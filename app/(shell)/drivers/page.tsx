"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import { fetchDriversPage, inviteDriver } from "@/lib/actions/members";
import type { DriverRow } from "@/lib/actions/members";
import { useFilterStore } from "@/stores/filters";

export default function DriversPage() {
  const { fleetId, listFilters, setListFilter } = useFilterStore();
  const [first, setFirst] = useState<{ key: string; items: DriverRow[]; nextCursor: string | null } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  const [mode, setMode] = useState<"existing" | "fresh">("existing");
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const f = listFilters["drivers"] ?? {};

  function reload() {
    if (!fleetId) return;
    fetchDriversPage(fleetId, null).then((r) => {
      if (r.ok) setFirst({ key: fleetId, items: r.data.items, nextCursor: r.data.nextCursor });
      else setFailed({ key: fleetId, message: r.message });
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fleetId]);

  const loading = !first || first.key !== fleetId;
  const showFailed = failed && failed.key === fleetId ? failed.message : null;

  const q = (f.q ?? "").trim();
  const status = f.status ?? "all";
  const predicate = (d: DriverRow) =>
    (!q || (d.name ?? "").includes(q) || (d.phone ?? "").includes(q)) &&
    (status === "all" || d.status === status);

  async function invite() {
    setError(null);
    setNote(null);
    if (!fleetId) {
      setError("اختار الأسطول الأول (x-fleet-id)");
      return;
    }
    const input =
      mode === "existing"
        ? { userId: userId.trim() || undefined }
        : { name, phone, password };
    const r = await inviteDriver(fleetId, input as Parameters<typeof inviteDriver>[1]);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setUserId("");
    setName("");
    setPhone("");
    setPassword("");
    setNote("اتضاف بنجاح");
    reload();
  }

  if (!fleetId) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="title-grad text-2xl font-extrabold">السواقين</h1>
        <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-[#606060]">اختار الأسطول الأول (x-fleet-id)</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="title-grad text-2xl font-extrabold">السواقين</h1>

      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="mb-3 font-bold">دعوة سواق</h2>
        <div className="mb-3 flex gap-2">
          <button type="button" onClick={() => setMode("existing")} aria-pressed={mode === "existing"} className={`rounded-xl px-4 py-1.5 text-sm ${mode === "existing" ? "bg-[#2f719e] text-white" : "bg-slate-100"}`}>من مستخدم موجود</button>
          <button type="button" onClick={() => setMode("fresh")} aria-pressed={mode === "fresh"} className={`rounded-xl px-4 py-1.5 text-sm ${mode === "fresh" ? "bg-[#2f719e] text-white" : "bg-slate-100"}`}>بيانات جديدة</button>
        </div>
        {mode === "existing" ? (
          <label className="block max-w-xs text-sm">
            <span className="mb-1 block font-medium">معرف المستخدم</span>
            <Input dir="ltr" placeholder="user uuid" value={userId} onChange={(e) => setUserId(e.target.value)} />
          </label>
        ) : (
          <div className="grid max-w-xl gap-3 md:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">الاسم</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">الموبايل</span>
              <Input dir="ltr" inputMode="tel" placeholder="01xxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">كلمة السر</span>
              <Input dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          </div>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
        {note && <p role="status" className="mt-2 text-sm text-green-700">{note}</p>}
        <Button type="button" className="mt-3" onClick={invite}>دعوة</Button>
      </div>

      {showFailed ? (
        <p role="alert" className="text-sm text-red-600">{showFailed}</p>
      ) : loading || !first ? (
        <p className="text-sm text-[#606060]">جاري التحميل…</p>
      ) : (
        <CursorList<DriverRow>
          key={fleetId}
          initialItems={first.items}
          initialCursor={first.nextCursor}
          loadMore={(cursor) =>
            fetchDriversPage(fleetId, cursor).then((r) => {
              if (!r.ok) throw new Error(r.message);
              return { items: r.data.items, nextCursor: r.data.nextCursor };
            })
          }
          keyOf={(d) => d.id}
          filter={predicate}
          filterBar={
            <div className="flex flex-wrap gap-2">
              <Input
                aria-label="بحث بالاسم أو الموبايل"
                placeholder="بحث بالاسم أو الموبايل"
                value={f.q ?? ""}
                onChange={(e) => setListFilter("drivers", { q: e.target.value })}
                className="max-w-xs bg-white"
              />
              <select
                aria-label="الحالة"
                value={status}
                onChange={(e) => setListFilter("drivers", { status: e.target.value })}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">كل الحالات</option>
                <option value="ACTIVE">نشط</option>
                <option value="SUSPENDED">موقوف</option>
                <option value="REVOKED">ملغي الصلاحية</option>
              </select>
            </div>
          }
          emptyMessage="لا يوجد سواقين في الأسطول ده"
          renderItem={(d) => (
            <Link
              href={`/drivers/${d.id}`}
              className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow transition-colors hover:bg-[#daeaf5]"
            >
              <span className="font-semibold text-[#1a1a1a]">
                {d.name ?? <span dir="ltr">{(d.userId ?? d.id).slice(0, 8)}…</span>}
                {d.phone ? <span className="text-sm text-[#606060]"> · <span dir="ltr">{d.phone}</span></span> : null}
              </span>
              <span className="text-sm text-[#606060]">{d.status}</span>
            </Link>
          )}
        />
      )}
    </div>
  );
}
