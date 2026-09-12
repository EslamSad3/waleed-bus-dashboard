"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CursorList } from "@/components/tables/cursor-list";
import {
  addMember,
  fetchMembersPage,
  fetchRoleOptions,
  removeMember,
  updateMember,
  MEMBER_STATUS_AR,
  type Member,
} from "@/lib/actions/members";

const REVOKE_WARNING = "الإجراء ده هيقفل جلسات المستخدم فورا — متأكد؟";

/** Fleet Members tab content (US5), embedded in the fleet detail page. */
export function MembersTab({ fleetId }: { fleetId: string }) {
  const [first, setFirst] = useState<{ items: Member[]; nextCursor: string | null } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [roles, setRoles] = useState<{ id: string; slug: string }[]>([]);
  const [userId, setUserId] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    fetchMembersPage(fleetId, null).then((r) => {
      if (r.ok) setFirst({ items: r.data.items, nextCursor: r.data.nextCursor });
      else setFailed(r.message);
    });
  }

  useEffect(() => {
    reload();
    fetchRoleOptions().then((r) => {
      if (r.ok) setRoles(r.data.items);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fleetId]);

  async function add() {
    setError(null);
    setNote(null);
    if (!userId.trim()) {
      setError("اكتب معرف المستخدم");
      return;
    }
    const r = await addMember(fleetId, { userId: userId.trim(), roleSlug: roleSlug || undefined });
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setUserId("");
    setRoleSlug("");
    setNote("اتضاف بنجاح");
    reload();
  }

  async function changeStatus(m: Member, next: Member["status"]) {
    setError(null);
    setNote(null);
    if (next !== "ACTIVE" && !window.confirm(REVOKE_WARNING)) return;
    const r = await updateMember(fleetId, m.id, { status: next });
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setNote("اتحفظ بنجاح");
    reload();
  }

  async function remove(m: Member) {
    setError(null);
    setNote(null);
    if (!window.confirm(`${REVOKE_WARNING} تمسح العضوية؟`)) return;
    const r = await removeMember(fleetId, m.id);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setNote("اتمسح بنجاح");
    reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="mb-3 font-bold">إضافة عضو</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">معرف المستخدم</span>
            <Input dir="ltr" placeholder="user uuid" value={userId} onChange={(e) => setUserId(e.target.value)} className="w-64" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">الدور</span>
            <select aria-label="اختار الدور" value={roleSlug} onChange={(e) => setRoleSlug(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">الدور الافتراضي</option>
              {roles.map((r) => (
                <option key={r.id} value={r.slug}>{r.slug}</option>
              ))}
            </select>
          </label>
          <Button type="button" onClick={add}>إضافة</Button>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {note && <p role="status" className="text-sm text-green-700">{note}</p>}

      {failed ? (
        <p role="alert" className="text-sm text-red-600">{failed}</p>
      ) : !first ? (
        <p className="text-sm text-[#606060]">جاري التحميل…</p>
      ) : (
        <CursorList<Member>
          initialItems={first.items}
          initialCursor={first.nextCursor}
          loadMore={(cursor) =>
            fetchMembersPage(fleetId, cursor).then((r) => {
              if (!r.ok) throw new Error(r.message);
              return { items: r.data.items, nextCursor: r.data.nextCursor };
            })
          }
          keyOf={(m) => m.id}
          emptyMessage="لا يوجد أعضاء في الأسطول ده"
          renderItem={(m) => (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 shadow">
              <span className="text-sm text-[#1a1a1a]">
                <span dir="ltr">{m.userId.slice(0, 8)}…</span>
                <span className="text-[#606060]"> · انضم <time dateTime={m.joinedAt}>{new Date(m.joinedAt).toLocaleDateString("en-EG")}</time></span>
              </span>
              <span className="flex items-center gap-2">
                <select
                  aria-label="حالة العضو"
                  value={m.status}
                  onChange={(e) => changeStatus(m, e.target.value as Member["status"])}
                  className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-sm"
                >
                  {(Object.keys(MEMBER_STATUS_AR) as Member["status"][]).map((s) => (
                    <option key={s} value={s}>{MEMBER_STATUS_AR[s]}</option>
                  ))}
                </select>
                <Button type="button" variant="destructive" onClick={() => remove(m)}>مسح</Button>
              </span>
            </div>
          )}
        />
      )}
    </div>
  );
}
