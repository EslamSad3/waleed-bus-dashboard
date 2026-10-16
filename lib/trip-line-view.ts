/** Displays both compact list rows and full detail rows returned by writes. */
export function lineEndpoints(line: {
  origin?: string | null;
  destination?: string | null;
  stops?: ReadonlyArray<{ stopOrder: number; station: { name: string } }>;
}): { origin: string | null; destination: string | null } {
  if (!line.stops) return { origin: line.origin ?? null, destination: line.destination ?? null };
  const ordered = [...line.stops].sort((a, b) => a.stopOrder - b.stopOrder);
  return { origin: ordered[0]?.station.name ?? null, destination: ordered[ordered.length - 1]?.station.name ?? null };
}

export function lineStopCount(line: { stopCount?: number; stops?: ReadonlyArray<unknown> }): number {
  return line.stops?.length ?? line.stopCount ?? 0;
}

/** Picker label: station · place · governorate, so a stop's real location is visible. */
export function stopPickerLabel(stop: {
  name: string;
  governorate?: { nameAr: string } | null;
  locality?: { nameAr: string; markaz?: { governorate?: { nameAr: string } | null } | null } | null;
}): string {
  const governorate = stop.locality?.markaz?.governorate?.nameAr ?? stop.governorate?.nameAr;
  return [stop.name, stop.locality?.nameAr, governorate].filter(Boolean).join(" · ");
}
