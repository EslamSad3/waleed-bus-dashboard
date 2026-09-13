"use client";

import { useState } from "react";
import { FleetPicker } from "@/components/fleet-picker";
import { FleetReportsTab } from "@/components/fleets/fleet-detail-listings";
import { setFleetScopeCookie } from "@/lib/fleet-scope-cookie";
import { useFilterStore } from "@/stores/filters";

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
        <div>
          <h1 className="page-title">التقارير</h1>
          <p className="page-description">بلاغات الركاب وملخص تقييمات كل أسطول.</p>
        </div>
      </div>
      <div className="panel-card mb-5 max-w-xl p-5 sm:p-6">
        <FleetPicker value={selectedFleetId} onChange={selectFleet} label="اختار أسطول التقرير" />
      </div>
      {selectedFleetId ? <FleetReportsTab fleetId={selectedFleetId} /> : <p className="empty-state">اختار أسطولًا لعرض تقاريره</p>}
    </div>
  );
}
