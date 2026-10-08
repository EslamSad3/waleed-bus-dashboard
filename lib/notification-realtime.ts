"use client";
import { useSyncExternalStore } from "react";
type RealtimeStatus = "connecting" | "connected" | "offline";
let realtimeStatus: RealtimeStatus = "connecting";
const statusListeners = new Set<() => void>();
export function setNotificationRealtimeStatus(value: RealtimeStatus): void {
  realtimeStatus = value;
  for (const listener of statusListeners) listener();
}
const subscribeStatus = (listener: () => void) => { statusListeners.add(listener); return () => { statusListeners.delete(listener); }; };
export function useNotificationRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(subscribeStatus, () => realtimeStatus, () => "connecting");
}
/** Shell owns the connection; logout closes it before discarding account state. */
let closeCurrent: (() => void) | null = null;
export function registerNotificationConnection(close: () => void): () => void {
  closeNotificationConnection();
  let closed = false;
  const closeOnce = () => { if (!closed) { closed = true; close(); } };
  closeCurrent = closeOnce;
  return () => { if (closeCurrent === closeOnce) closeCurrent = null; closeOnce(); };
}
export function closeNotificationConnection(): void { closeCurrent?.(); closeCurrent = null; }

export type BookingNotificationEvent = { version: 1; eventId: string; type: "booking.created"; notificationId: string; bookingId: string; tripId: string; ownerId: string };
export function isBookingNotificationEvent(value: unknown): value is BookingNotificationEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return event.version === 1 && event.type === "booking.created" && ["eventId", "notificationId", "bookingId", "tripId", "ownerId"].every((key) => typeof event[key] === "string" && uuid.test(event[key] as string));
}
