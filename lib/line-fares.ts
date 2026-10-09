export type FarePair = { boardingStationId: string; landingStationId: string; boardingStationName?: string; landingStationName?: string; scope?: string };
export type FareInput = FarePair & { unitFare: string };
export type FareStop = { stationId: string; stopType: string; stopOrder: number; name: string };
export const fareKey = (pair: FarePair) => `${pair.boardingStationId}:${pair.landingStationId}`;
export function farePairs(stops: FareStop[], retained: FarePair[] = []): FarePair[] {
  const pairs = new Map<string, FarePair>();
  for (const b of stops.filter(s => s.stopType === "BOARDING")) {
    for (const d of stops.filter(s => s.stopType === "LANDING" && s.stopOrder > b.stopOrder && s.stationId !== b.stationId)) {
      const pair = { boardingStationId: b.stationId, landingStationId: d.stationId, boardingStationName: b.name, landingStationName: d.name, scope: "CURRENT" };
      pairs.set(fareKey(pair), pair);
    }
  }
  for (const p of retained) if (!pairs.has(fareKey(p))) pairs.set(fareKey(p), { ...p, scope: "FROZEN_TRIP" });
  return [...pairs.values()];
}
export function faresPayload(pairs: FarePair[], prices: Record<string, string>): FareInput[] {
  return pairs.map(p => ({ boardingStationId: p.boardingStationId, landingStationId: p.landingStationId, unitFare: (prices[fareKey(p)] ?? "").trim() }));
}
