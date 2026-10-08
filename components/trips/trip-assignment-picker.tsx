"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchBusTripsPage } from "@/lib/actions/buses";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/t";

/** A bus is fixed; only scheduled trips on that bus may be reassigned. */
export function TripAssignmentPicker({ ownerId, busId, value, onChange }: { ownerId: string; busId: string; value: string; onChange: (id: string) => void }) {
  const query = useInfiniteQuery({ queryKey: ["assignment-trips", ownerId, busId], initialPageParam: null as string | null, enabled: Boolean(ownerId && busId),
    queryFn: async ({ pageParam }) => { const r = await fetchBusTripsPage(ownerId, busId, pageParam); if (!r.ok) throw new Error(r.message); return r.data; },
    getNextPageParam: (page) => page.nextCursor });
  const trips = query.data?.pages.flatMap((p) => p.items).filter((trip) => trip.status === "SCHEDULED") ?? [];
  return <div className="space-y-2">
    <label className="block text-sm font-bold">{t("tripAssignment.pickTrip")}
      <Select fieldName="tripId" value={value} onChange={(e) => onChange(e.target.value)} disabled={!busId || query.isPending} className="select-field mt-1 w-full">
        <option value="">{t("tripAssignment.pickTrip")}</option>
        {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.line.origin} ← {trip.line.destination} · {new Date(trip.departAt).toLocaleString("ar-EG")} · {trip.driver?.name ?? t("tripAssignment.unassigned")}</option>)}
      </Select>
    </label>
    {!query.isPending && !trips.length ? <p className="text-xs">{t("tripAssignment.noTrips")}</p> : null}
    {query.error ? <p role="alert" className="text-xs text-red-600">{query.error.message}</p> : null}
    {query.hasNextPage ? <Button type="button" variant="ghost" onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage}>{t("tripAssignment.moreTrips")}</Button> : null}
  </div>;
}
