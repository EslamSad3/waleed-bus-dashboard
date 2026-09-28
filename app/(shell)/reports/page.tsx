"use client";

import { useState } from "react";
import { FleetPicker } from "@/components/fleet-picker";
import { FleetReportsTab } from "@/components/fleets/fleet-detail-listings";
import { setFleetScopeCookie } from "@/lib/fleet-scope-cookie";
import { useFilterStore } from "@/stores/filters";
import { t } from "@/lib/i18n/t";

export default function ReportsPage() {
  const fleetId = useFilterStore((state) => state.fleetId);
  const setFleetId = useFilterStore((state) => state.setFleetId);
  const [selectedFleetId, setSelectedFleetId] = useState(fleetId ?? "");

  function selectFleet(id: string) {
    setSelectedFleetId(id);
    setFleetId(id || null);
    setFleetScopeCookie(id || null);
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0">
          <h1 className="page-title">{t("reports.title")}</h1>
          <p className="page-description">{t("reports.description")}</p>
        </div>
      </div>
      <div className="panel-card mb-5 max-w-xl p-5 sm:p-6">
        <FleetPicker value={selectedFleetId} onChange={selectFleet} label={t("reports.pickFleet")} />
      </div>
      {selectedFleetId ? <FleetReportsTab fleetId={selectedFleetId} /> : <p className="empty-state">{t("reports.pickFleetHint")}</p>}
    </div>
  );
}
