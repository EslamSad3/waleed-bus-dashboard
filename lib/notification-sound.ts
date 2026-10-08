"use client";
import { useSyncExternalStore } from "react";

/**
 * Short two-tone chime synthesized with Web Audio — no asset to ship or cache.
 * Browsers only allow audio after a user gesture, so the context is unlocked
 * on the first pointer/key interaction with the dashboard.
 */
const STORAGE_KEY = "notification-sound";
let context: AudioContext | null = null;
let enabled = true;
const listeners = new Set<() => void>();

try { enabled = window.localStorage.getItem(STORAGE_KEY) !== "off"; } catch { /* storage blocked: keep default */ }

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  context ??= new AudioContext();
  return context;
}

export function unlockNotificationSound(): void {
  const ctx = audio();
  if (ctx?.state === "suspended") void ctx.resume().catch(() => {});
}

export function playNotificationSound(): void {
  if (!enabled) return;
  const ctx = audio();
  if (!ctx || ctx.state !== "running") return;
  const start = ctx.currentTime;
  for (const [offset, frequency] of [[0, 880], [0.14, 1320]] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.18, start + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.28);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start + offset);
    osc.stop(start + offset + 0.3);
  }
}

export function setNotificationSoundEnabled(value: boolean): void {
  enabled = value;
  try { window.localStorage.setItem(STORAGE_KEY, value ? "on" : "off"); } catch { /* per-viewer preference only */ }
  if (value) { unlockNotificationSound(); playNotificationSound(); }
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useNotificationSoundEnabled(): boolean {
  return useSyncExternalStore(subscribe, () => enabled, () => true);
}
