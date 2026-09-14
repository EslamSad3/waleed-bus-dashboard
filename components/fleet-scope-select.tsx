"use client";

import { useEffect, useState } from "react";
import { useFilterStore } from "@/stores/filters";
import { FLEET_SCOPE_COOKIE, setFleetScopeCookie } from "@/lib/fleet-scope-cookie";
import { apiGet } from "@/lib/actions/http";
import { Building2, ChevronDown } from "lucide-react";

type FleetOption = { id: string; name: string; isActive?: boolean };

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${FLEET_SCOPE_COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Global Fleet-Scope Selector.
 * Allows the Super Admin to choose the active working fleet from the topbar across all pages.
 * Persists to zustand filter store and cookie (`fleet_scope`) so that tenant-path API calls
 * automatically receive `x-fleet-id`.
 */
export function FleetScopeSelect() {
  const { fleetId, setFleetId } = useFilterStore();
  const [fleets, setFleets] = useState<FleetOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = readCookie();
    if (saved && !fleetId) {
      setFleetId(saved);
    }

    let active = true;
    apiGet<{ items: FleetOption[] }>("/api/fleets?limit=100").then((res) => {
      if (!active) return;
      if (res.ok) {
        setFleets(res.data.items);
        // If there's only one fleet or if a saved cookie matches, ensure it's selected
        if (!saved && !fleetId && res.data.items.length === 1) {
          const onlyId = res.data.items[0].id;
          setFleetId(onlyId);
          setFleetScopeCookie(onlyId);
        }
      }
      setLoaded(true);
    });

    return () => {
      active = false;
    };
  }, [fleetId, setFleetId]);

  function handleChange(id: string) {
    const val = id || null;
    setFleetId(val);
    setFleetScopeCookie(val);
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="global-fleet-select"
        className="flex items-center gap-2 rounded-2xl border border-[#c4def3] bg-white px-3 py-1.5 shadow-sm transition hover:border-[#2f719e]"
      >
        <span className="grid size-7 place-items-center rounded-lg bg-[#daeaf5] text-[#204c6b]">
          <Building2 className="size-4" />
        </span>
        <div className="flex flex-col text-start">
          <span className="text-[10px] font-bold text-[#5e6b78]">الأسطول النشط</span>
          <div className="relative flex items-center">
            <select
              id="global-fleet-select"
              aria-label="الأسطول النشط"
              value={fleetId ?? ""}
              onChange={(e) => handleChange(e.target.value)}
              disabled={!loaded}
              className="appearance-none bg-transparent pe-6 text-xs sm:text-sm font-extrabold text-[#204c6b] focus:outline-none cursor-pointer max-w-[160px] sm:max-w-[220px] truncate"
            >
              <option value="">-- اختار الأسطول --</option>
              {fleets.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-0 size-3.5 text-[#2f719e]" />
          </div>
        </div>
      </label>
    </div>
  );
}
