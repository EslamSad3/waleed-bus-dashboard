"use client";

import { useState } from "react";
import { OwnerPicker } from "@/components/owners/owner-picker";
import { OwnerReports } from "@/components/owners/owner-sections";
import { setOwnerScopeCookie } from "@/lib/owner-scope-cookie";
import { useFilterStore } from "@/stores/filters";
import { t } from "@/lib/i18n/t";

/** Passenger reports and split bus/driver rating averages for one company. */
export default function ReportsPage() {
  const ownerId = useFilterStore((state) => state.ownerId);
  const setOwnerId = useFilterStore((state) => state.setOwnerId);
  const [selectedOwnerId, setSelectedOwnerId] = useState(ownerId ?? "");

  function selectOwner(id: string) {
    setSelectedOwnerId(id);
    setOwnerId(id || null);
    setOwnerScopeCookie(id || null);
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
        <OwnerPicker ownerId={selectedOwnerId} onOwnerChange={selectOwner} label={t("reports.pickOwner")} />
      </div>
      {selectedOwnerId ? <OwnerReports ownerId={selectedOwnerId} /> : <p className="empty-state">{t("reports.pickOwnerHint")}</p>}
    </div>
  );
}
