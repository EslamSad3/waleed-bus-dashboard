/** datetime-local represents the operator's local wall clock, without a zone. */
export function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Omit an unchanged value so a driver-only edit preserves seconds and milliseconds. */
export function editedDeparture(original: string, input: string): string | undefined {
  return input === toLocalDateTimeInput(original) ? undefined : new Date(input).toISOString();
}
