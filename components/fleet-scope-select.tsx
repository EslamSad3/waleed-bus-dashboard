"use client";

import { useEffect, useState } from "react";
import { useFilterStore } from "@/stores/filters";
import { FLEET_SCOPE_COOKIE } from "@/lib/fleet-scope-cookie";

type FleetOption = { id: string; name: string };

function readCookie(): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${FLEET_SCOPE_COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Fleet-scope selector (research R6). Persists to zustand + cookie so
 * server-side tenant calls can send `x-fleet-id`. Options come from `GET /fleets`.
 */
export function FleetScopeSelect() {
  const { fleetId, setFleetId } = useFilterStore();
  const [fleets, setFleets] = useState<FleetOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = readCookie();
    if (saved && !fleetId) setFleetId(saved);
    fetch("/api/fleets?limit=100", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const items = Array.isArray(j?.data?.items) ? j.data.items : [];
        setFleets(items.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name })));
      })
      .catch(() => setFleets([]))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange(id: string) {
    const value = id || null;
    setFleetId(value);
    document.cookie = value
      ? `${FLEET_SCOPE_COOKIE}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=31536000`
      : `${FLEET_SCOPE_COOKIE}=; Path=/; Max-Age=0`;
  }

  return (
    <label className="flex items-center gap-2 text-sm text-[#606060]">
      <span id="fleet-scope-label">الأسطول</span>
      <select
        aria-labelledby="fleet-scope-label"
        value={fleetId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={!loaded}
        className="max-w-48 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-[#1a1a1a] focus-visible:outline-2 focus-visible:outline-[#2f719e]"
      >
        <option value="">اختار الأسطول</option>
        {fleets.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </label>
  );
}
