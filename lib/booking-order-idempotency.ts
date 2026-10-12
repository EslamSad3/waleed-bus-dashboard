/**
 * Payload-bound idempotency for staff grouped booking orders.
 *
 * The replay key belongs to the exact submitted payload, not to the dialog
 * session: retrying an unchanged submission must reuse the key (so the backend
 * replays the original order instead of double-booking), while any edit must
 * mint a fresh key (so a lost response can never replay a stale order).
 *
 * A single slot is not enough: if A commits but its response is lost, B is
 * submitted and rejected, then A is restored, overwriting A's key before the
 * result was known would hand A a third key and risk a duplicate. Unresolved
 * submissions are therefore kept in a small fingerprint → key map, and a
 * success removes only its own entry.
 *
 * Pure and dependency-free so plain `node --test` can import it.
 */

export type OrderPayloadItem = {
  boardingStationId: string;
  landingStationId: string;
  seatCount: number;
  passengerName: string;
  passengerPhone: string;
};

export type OrderPayload = {
  tripId: string;
  paymentMethod: string;
  note?: string | undefined;
  items: OrderPayloadItem[];
};

/**
 * Canonical staff phone form (`01XXXXXXXXX`). Mirrors the backend's
 * normalizePhone: whitespace and dashes are ignored, `+20…` and `0020…`
 * collapse to the leading `0`. Non-throwing: validation already rejected
 * anything that cannot canonicalise.
 */
export function normalizeOrderPhone(input: string): string {
  const compact = input.trim().replace(/[\s-]+/g, "");
  if (compact.startsWith("+20")) return `0${compact.slice(3)}`;
  if (compact.startsWith("0020")) return `0${compact.slice(4)}`;
  return compact;
}

/**
 * Stable fingerprint of the request body WITHOUT the idempotency key:
 * trip, payment method, note and every item in order (stations, seats, trimmed
 * name, normalised phone).
 */
export function fingerprintOrderPayload(payload: OrderPayload): string {
  return JSON.stringify({
    tripId: payload.tripId,
    paymentMethod: payload.paymentMethod,
    note: payload.note ?? "",
    items: payload.items.map((item) => ({
      boardingStationId: item.boardingStationId,
      landingStationId: item.landingStationId,
      seatCount: item.seatCount,
      passengerName: item.passengerName,
      passengerPhone: normalizeOrderPhone(item.passengerPhone),
    })),
  });
}

/** Fingerprint → key for submissions sent but not yet confirmed (insertion-ordered). */
export type PendingOrderKeys = Map<string, string>;

/** Upper bound so the map cannot grow without limit; oldest evicted first. */
export const MAX_PENDING_ORDER_KEYS = 20;

/**
 * Reuse the key for a known fingerprint, otherwise mint a fresh one and track
 * it. A hit leaves insertion order untouched; overflow evicts the oldest entry.
 */
export function keyForPayload(
  pending: PendingOrderKeys,
  fingerprint: string,
  generateKey: () => string,
): { pending: PendingOrderKeys; key: string } {
  const known = pending.get(fingerprint);
  if (known !== undefined) return { pending, key: known };
  const next = new Map(pending);
  next.set(fingerprint, generateKey());
  while (next.size > MAX_PENDING_ORDER_KEYS) {
    const oldest = next.keys().next();
    if (oldest.done) break;
    next.delete(oldest.value);
  }
  return { pending: next, key: next.get(fingerprint) as string };
}

/** Drop one confirmed submission; every other unresolved entry is kept. */
export function resolveOrderPayload(pending: PendingOrderKeys, fingerprint: string): PendingOrderKeys {
  if (!pending.has(fingerprint)) return pending;
  const next = new Map(pending);
  next.delete(fingerprint);
  return next;
}

/**
 * Business rejections that guarantee the backend created no order. Entries
 * failing with one of these are settled (dropped): only ambiguous outcomes
 * (no code, network errors, 5xx, rate limits, auth) stay pending so a retry
 * reuses the key. The 20-entry cap is a memory bound that 20+ ambiguous
 * failures in one page session can alone reach.
 */
export const DEFINITIVE_REJECTION_CODES: ReadonlySet<string> = new Set([
  "PRICE_CHANGED",
  "PRICE_CONFIRMATION_REQUIRED",
  "SEATS_UNAVAILABLE",
  "DUPLICATE_ORDER_ITEM",
  "INVALID_TRIP_STOPS",
  "TRIP_NOT_FOUND",
  "TRIP_NOT_BOOKABLE",
  "TRIP_ALREADY_STARTED",
  "DRIVER_ASSIGNMENT_REQUIRED",
  "TRIP_ROUTE_MISSING",
  "PRICING_INCOMPLETE",
  "VALIDATION_FAILED",
]);

/** Drop a definitively rejected submission; keep ambiguous failures pending. */
export function settleFailedPayload(
  pending: PendingOrderKeys,
  fingerprint: string,
  code?: string,
): PendingOrderKeys {
  if (code === undefined || !DEFINITIVE_REJECTION_CODES.has(code)) return pending;
  return resolveOrderPayload(pending, fingerprint);
}
