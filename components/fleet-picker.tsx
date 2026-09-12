"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/actions/http";

type FleetOption = { id: string; name: string };

/**
 * Standalone fleet dropdown for forms that need an explicit fleet
 * (independent of the global topbar scope selector).
 */
export function FleetPicker({
  value,
  onChange,
  label = "الأسطول",
}: {
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const [fleets, setFleets] = useState<FleetOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiGet<{ items: FleetOption[] }>("/api/fleets?limit=100").then((r) => {
      if (r.ok) setFleets(r.data.items);
      setLoaded(true);
    });
  }, []);

  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!loaded}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
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
