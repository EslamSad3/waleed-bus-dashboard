"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/actions/http";
import { t } from "@/lib/i18n/t";

type FleetOption = { id: string; name: string };

/**
 * Standalone fleet dropdown for forms that need an explicit fleet
 * (independent of the global topbar scope selector).
 */
export function FleetPicker({
  value,
  onChange,
  label = t("common.fields.fleet"),
}: {
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const [fleets, setFleets] = useState<FleetOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiGet<{ items: FleetOption[] }>("/api/fleet-owners/fleets?limit=100").then((r) => {
      if (r.ok) setFleets(r.data.items);
      setLoaded(true);
    });
  }, []);

  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {loaded ? (
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="select-field w-full"
        >
          <option value="">{t("fleetOwnerPicker.pickFleetOption")}</option>
          {fleets.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      ) : (
        <span role="status" className="block">
          <span className="sr-only">{t("common.loading.more")}</span>
          <Skeleton aria-hidden="true" className="h-11 w-full rounded-xl" />
        </span>
      )}
    </label>
  );
}
