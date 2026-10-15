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
