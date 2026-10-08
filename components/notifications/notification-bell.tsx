"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BusFront, CheckCheck, MoreHorizontal, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useApiQuery, useQueryClient } from "@/lib/queries";
import { fetchMyNotifications, fetchMyUnreadCount, markNotificationRead, markAllNotificationsRead, deleteNotification, deleteAllNotifications } from "@/lib/actions/notifications";
import { t } from "@/lib/i18n/t";
import { useNotificationRealtimeStatus } from "@/lib/notification-realtime";
import { setNotificationSoundEnabled, useNotificationSoundEnabled } from "@/lib/notification-sound";

export function NotificationBell({ userId }: { userId: string }) {
  const client = useQueryClient();
  const realtimeStatus = useNotificationRealtimeStatus();
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const headingId = useId();
  const soundOn = useNotificationSoundEnabled();
  const count = useApiQuery(["my-notification-count", userId], fetchMyUnreadCount);
  const unreadCount = count.data?.unreadCount ?? 0;
  const inbox = useInfiniteQuery({
    queryKey: ["my-notifications", userId, unreadOnly], enabled: open,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => { const r = await fetchMyNotifications(pageParam, unreadOnly); if (!r.ok) throw new Error(r.message); return r.data; },
    getNextPageParam: (page) => page.nextCursor,
  });
  const rows = [...new Map((inbox.data?.pages.flatMap((p) => p.items) ?? []).map((row) => [row.id, row])).values()];

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  async function mutate(action: typeof markAllNotificationsRead) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const r = await action();
      if (!r.ok) { setError(r.message); return; }
      await Promise.all([client.invalidateQueries({ queryKey: ["my-notifications", userId] }), client.invalidateQueries({ queryKey: ["my-notification-count", userId] })]);
    } finally { setBusy(false); }
  }

  return <div ref={root} className="relative">
    <Button ref={trigger} variant="ghost" size="sm" onClick={() => setOpen((value) => !value)} aria-label={t("notificationInbox.bell")} aria-expanded={open} aria-controls={open ? panelId : undefined}
      className={`relative size-10 rounded-full p-0 ${open ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-700"}`}>
      <Bell className="size-5" aria-hidden="true" />
      {unreadCount > 0 ? <span className="absolute -end-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-5 text-white">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
    </Button>
    {open ? <div ref={panel} id={panelId} role="region" aria-labelledby={headingId} tabIndex={-1}
      className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 outline-none sm:absolute sm:inset-x-auto sm:end-0 sm:top-[calc(100%+0.75rem)] sm:w-[400px]">
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 id={headingId} className="text-xl font-extrabold text-slate-900">{t("notificationInbox.title")}</h2>
        <div className="flex items-center gap-1">
          <details className="relative">
            <summary aria-label={t("notificationInbox.options")} className="grid size-8 cursor-pointer list-none place-items-center rounded-full text-slate-500 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"><MoreHorizontal className="size-5" aria-hidden="true" /></summary>
            <div className="absolute end-0 top-10 z-10 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              <Button variant="ghost" size="sm" className="w-full justify-start" disabled={busy || !unreadCount} onClick={() => void mutate(markAllNotificationsRead)}><CheckCheck className="size-4" aria-hidden="true" />{t("notificationInbox.markAllRead")}</Button>
              <Button variant="ghost" size="sm" className="w-full justify-start" aria-pressed={soundOn} onClick={() => setNotificationSoundEnabled(!soundOn)}>{soundOn ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}{t(soundOn ? "notificationInbox.soundOff" : "notificationInbox.soundOn")}</Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-red-600" disabled={busy || !rows.length} onClick={() => void mutate(deleteAllNotifications)}><Trash2 className="size-4" aria-hidden="true" />{t("notificationInbox.deleteAll")}</Button>
            </div>
          </details>
          <Button variant="ghost" size="sm" className="size-8 rounded-full p-0" aria-label={t("notificationInbox.close")} onClick={() => { setOpen(false); trigger.current?.focus(); }}><X className="size-4" aria-hidden="true" /></Button>
        </div>
      </div>
      <div className="flex gap-2 px-4 py-3" role="group" aria-label={t("notificationInbox.filter")}>
        {[false, true].map((unread) => <button key={String(unread)} type="button" aria-pressed={unreadOnly === unread} onClick={() => setUnreadOnly(unread)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${unreadOnly === unread ? "bg-sky-100 text-sky-700" : "text-slate-600 hover:bg-slate-100"}`}>{t(unread ? "notificationInbox.unread" : "notificationInbox.all")}</button>)}
      </div>
      {error || inbox.error ? <p role="alert" className="px-4 pb-2 text-sm text-red-600">{error ?? inbox.error?.message}</p> : null}
      {inbox.isPending ? <p className="px-4 py-8 text-center text-sm text-slate-500">{t("notificationInbox.loading")}</p> : !rows.length ? <div className="px-4 py-8 text-center text-slate-500"><Bell className="mx-auto mb-3 size-8 text-slate-300" aria-hidden="true" /><p className="text-sm">{t("notificationInbox.empty")}</p></div> : null}
      <ul className="max-h-[min(60vh,520px)] overflow-y-auto px-2 pb-2">
        {rows.map((row) => <li key={row.id} className="group relative flex gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50">
          <span className={`grid size-11 shrink-0 place-items-center rounded-full ${row.isRead ? "bg-slate-100 text-slate-500" : "bg-sky-100 text-sky-700"}`}><BusFront className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            {row.bookingId ? <Link href={`/bookings/${row.bookingId}`} className="block rounded outline-offset-2" onClick={() => { if (!row.isRead) void mutate(() => markNotificationRead(row.id)); setOpen(false); }}><p className={`text-sm leading-6 ${row.isRead ? "text-slate-700" : "font-bold text-slate-900"}`}>{row.title}</p><p className="line-clamp-2 text-xs leading-5 text-slate-500">{row.body}</p></Link> : <div><p className="text-sm font-bold text-slate-900">{row.title}</p><p className="line-clamp-2 text-xs leading-5 text-slate-500">{row.body}</p></div>}
            <time className={`mt-1 block text-[11px] ${row.isRead ? "text-slate-400" : "font-semibold text-sky-600"}`}>{new Date(row.createdAt).toLocaleString("ar-EG")}</time>
            <div className="mt-1 flex gap-2">
              {!row.isRead ? <button type="button" className="text-[11px] text-sky-700 hover:underline disabled:opacity-50" disabled={busy} onClick={() => void mutate(() => markNotificationRead(row.id))}>{t("notificationInbox.markRead")}</button> : null}
              <button type="button" className="text-[11px] text-slate-500 hover:underline disabled:opacity-50" disabled={busy} onClick={() => void mutate(() => deleteNotification(row.id))}>{t("notificationInbox.delete")}</button>
            </div>
          </div>
          {!row.isRead ? <span className="mt-4 size-2.5 shrink-0 rounded-full bg-sky-600" aria-label={t("notificationInbox.unread")} /> : null}
        </li>)}
      </ul>
      {inbox.hasNextPage ? <div className="px-4 pb-3"><Button className="w-full rounded-xl" variant="ghost" onClick={() => void inbox.fetchNextPage()} loading={inbox.isFetchingNextPage}>{t("notificationInbox.more")}</Button></div> : null}
      <p role="status" className="flex items-center gap-2 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500"><span aria-hidden="true" className={`size-1.5 rounded-full ${realtimeStatus === "connected" ? "bg-emerald-500" : "bg-amber-500"}`} />{realtimeStatus === "connected" ? t("notificationInbox.connected") : realtimeStatus === "connecting" ? t("notificationInbox.connecting") : t("notificationInbox.offline")}</p>
    </div> : null}
  </div>;
}
