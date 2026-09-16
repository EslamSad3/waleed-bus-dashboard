"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchUserOptions, type Fleet } from "@/lib/actions/fleets";
import { apiGet } from "@/lib/actions/http";

type Owner = { id: string; name?: string | null; phone?: string | null; phoneNumber?: string | null };

/**
 * Selects the accountable fleet owner first, then the owner's fleet when
 * necessary. A driver is rostered to a fleet; no bus is selected here.
 */
export function FleetOwnerFleetPicker({
  fleetId,
  onFleetChange,
}: {
  fleetId: string;
  onFleetChange: (fleetId: string) => void;
}) {
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<{ items: Fleet[] }>("/api/fleets?limit=100"),
      fetchUserOptions(),
    ]).then(([fleetsResult, usersResult]) => {
      if (!fleetsResult.ok) {
        setError(fleetsResult.message);
      } else if (!usersResult.ok) {
        setError(usersResult.message);
      } else {
        setFleets(fleetsResult.data.items.filter((fleet) => fleet.isActive));
        setOwners(usersResult.data.items);
      }
      setLoaded(true);
    });
  }, []);

  const ownerOptions = useMemo(() => {
    const ownersById = new Map(owners.map((owner) => [owner.id, owner]));
    return [...new Set(fleets.map((fleet) => fleet.ownerId))].map((id) => {
      const owner = ownersById.get(id);
      return {
        id,
        label: owner?.name || owner?.phoneNumber || owner?.phone || "مالك أسطول بدون اسم",
      };
    });
  }, [fleets, owners]);

  const ownerFleets = fleets.filter((fleet) => fleet.ownerId === ownerId);

  function chooseOwner(nextOwnerId: string) {
    setOwnerId(nextOwnerId);
    const availableFleets = fleets.filter((fleet) => fleet.ownerId === nextOwnerId);
    onFleetChange(availableFleets.length === 1 ? availableFleets[0].id : "");
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="mb-2 block font-bold text-[#334454]">مالك الأسطول</span>
        <select
          aria-label="مالك الأسطول"
          value={ownerId}
          onChange={(event) => chooseOwner(event.target.value)}
          disabled={!loaded}
          className="select-field w-full"
        >
          <option value="">اختار مالك الأسطول</option>
          {ownerOptions.map((owner) => <option key={owner.id} value={owner.id}>{owner.label}</option>)}
        </select>
      </label>

      {ownerId && ownerFleets.length > 1 ? (
        <label className="block text-sm">
          <span className="mb-2 block font-bold text-[#334454]">الأسطول</span>
          <select aria-label="الأسطول" value={fleetId} onChange={(event) => onFleetChange(event.target.value)} className="select-field w-full">
            <option value="">اختار الأسطول</option>
            {ownerFleets.map((fleet) => <option key={fleet.id} value={fleet.id}>{fleet.name}</option>)}
          </select>
        </label>
      ) : null}

      {error ? <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p> : null}
      <p className="text-xs leading-5 text-[#606060] sm:col-span-2">سيُنشأ حساب السائق داخل أسطول هذا المالك فقط. تعيين الأتوبيس يتم لاحقًا من صفحة الأتوبيس.</p>
    </div>
  );
}
