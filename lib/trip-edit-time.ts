/**
 * Trip times are entered and shown as Cairo wall-clock time — the API's
 * business timezone — whatever zone the operator's browser is in.
 */
const BUSINESS_TZ = "Africa/Cairo";

/** Offset of Cairo wall-clock time from UTC at `instant`, in ms (DST-aware). */
function cairoOffsetMs(instant: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: BUSINESS_TZ,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - (instant.getTime() - instant.getMilliseconds());
}

/** `YYYY-MM-DDTHH:mm` read as Cairo wall-clock time → UTC ISO string ("" when invalid). */
export function cairoInputToIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return "";
  const [, y, mo, d, h, mi] = match.map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  // Re-check the offset at the result so a DST switch between the two guesses is honoured.
  const first = naive - cairoOffsetMs(new Date(naive));
  return new Date(naive - cairoOffsetMs(new Date(first))).toISOString();
}

/** datetime-local value for an instant, as Cairo wall-clock time (no zone). */
export function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() + cairoOffsetMs(date)).toISOString().slice(0, 16);
}

/** Omit an unchanged value so a driver-only edit preserves seconds and milliseconds. */
export function editedDeparture(original: string, input: string): string | undefined {
  return input === toLocalDateTimeInput(original) ? undefined : cairoInputToIso(input);
}
