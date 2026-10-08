"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Realtime, TokenRequest } from "ably";
import { toast } from "sonner";
import { useQueryClient } from "@/lib/queries";
import { isBookingNotificationEvent, registerNotificationConnection, setNotificationRealtimeStatus } from "@/lib/notification-realtime";
import { fetchMyNotifications, markNotificationRead } from "@/lib/actions/notifications";
import { playNotificationSound, unlockNotificationSound } from "@/lib/notification-sound";
import { t } from "@/lib/i18n/t";

/** One connection per authenticated shell, private credentials only in memory. */
export function NotificationRealtime({ userId }: { userId: string }) {
  const client = useQueryClient();
  const router = useRouter();
  useEffect(() => {
    let stopped = false;
    let ably: Realtime | null = null;
    let connecting = false;
    let channelName = "";
    const seen = new Set<string>();
    const reconcile = () => { if (!stopped) void client.invalidateQueries({ predicate: (q) => /notification|booking|trip/.test(String(q.queryKey[0])), refetchType: "active" }); };
    const receive = (message: { data?: unknown }) => {
      if (stopped || !isBookingNotificationEvent(message.data) || seen.has(message.data.eventId)) return;
      seen.add(message.data.eventId);
      if (seen.size > 500) seen.delete(seen.values().next().value!);
      reconcile();
      void announce(message.data.notificationId, message.data.bookingId);
    };
    // The event carries ids only; the stored row supplies the authorized copy.
    const announce = async (notificationId: string, bookingId: string) => {
      playNotificationSound();
      const page = await fetchMyNotifications(null, true).catch(() => null);
      const row = page?.ok ? page.data.items.find((item) => item.id === notificationId) : undefined;
      if (stopped) return;
      toast(row?.title ?? t("notificationInbox.newBooking"), {
        id: notificationId,
        description: row?.body ?? undefined,
        duration: 8000,
        action: {
          label: t("notificationInbox.booking"),
          onClick: () => {
            void markNotificationRead(notificationId).then(() => reconcile());
            router.push(`/bookings/${bookingId}`);
          },
        },
      });
    };
    const auth = async () => {
      const response = await fetch("/api/notifications/realtime-token", { method: "POST", credentials: "same-origin", cache: "no-store" });
      if (!response.ok) {
        console.warn(`Notification realtime authentication unavailable (${response.status})`);
        throw new Error("Realtime authentication unavailable");
      }
      // The BFF preserves {statusCode,data}; unwrap once before the SDK sees it.
      const body = await response.json() as { data: { channel: string; tokenRequest: TokenRequest } };
      if (!body.data.channel.startsWith(`notifications:user:${userId}:v`)) throw new Error("Realtime identity mismatch");
      if (stopped) throw new Error("Realtime connection closed");
      if (ably && channelName && channelName !== body.data.channel) {
        const old = ably.channels.get(channelName); old.unsubscribe(); void old.detach().catch(() => {});
        void ably.channels.get(body.data.channel).subscribe("booking.created", receive).catch(() => {});
      }
      channelName = body.data.channel;
      return body.data.tokenRequest;
    };
    const unregister = registerNotificationConnection(() => { stopped = true; ably?.close(); setNotificationRealtimeStatus("offline"); });
    const connect = async () => {
      if (stopped || ably || connecting) return;
      connecting = true;
      setNotificationRealtimeStatus("connecting");
      let stage = "authentication";
      try {
        const tokenRequest = await auth();
        stage = "client initialization";
        const sdk = await import("ably");
        if (stopped) return;
        let first = true;
        ably = new sdk.Realtime({ authCallback: (_params, callback) => {
          if (first) { first = false; callback(null, tokenRequest); return; }
          void auth().then((request) => callback(null, request)).catch(() => callback("Authentication unavailable", null));
        } });
        ably.connection.on("connected", () => { if (!stopped) { setNotificationRealtimeStatus("connected"); reconcile(); } });
        ably.connection.on(["disconnected", "suspended"], () => { if (!stopped) setNotificationRealtimeStatus("offline"); });
        ably.connection.on("failed", () => { ably?.close(); ably = null; if (!stopped) setNotificationRealtimeStatus("offline"); });
        stage = "channel subscription";
        await ably.channels.get(channelName).subscribe("booking.created", receive);
      } catch { ably?.close(); ably = null; if (!stopped) { setNotificationRealtimeStatus("offline"); console.warn(`Notification realtime retry pending: ${stage}`); } }
      finally { connecting = false; }
    };
    void connect();
    const unlock = () => unlockNotificationSound();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    const sync = () => { if (document.visibilityState === "visible") { reconcile(); void connect(); } };
    const timer = window.setInterval(sync, 30_000);
    const focus = sync;
    document.addEventListener("visibilitychange", focus);
    return () => { unregister(); window.clearInterval(timer); document.removeEventListener("visibilitychange", focus); window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, [client, router, userId]);
  return null;
}
