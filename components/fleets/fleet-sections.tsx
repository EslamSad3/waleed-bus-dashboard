"use client";

import { useState } from "react";
import { FleetBookingsTab, FleetBusesTab, FleetReportsTab, FleetTripsTab } from "@/components/fleets/fleet-detail-listings";
import { MembersTab } from "@/components/fleets/members-tab";
import { t as tr } from "@/lib/i18n/t";

const TABS = [
  { key: "buses", label: tr("common.tab.buses") },
  { key: "members", label: tr("common.tab.members") },
  { key: "trips", label: tr("common.tab.trips") },
  { key: "bookings", label: tr("common.tab.bookings") },
  { key: "reports", label: tr("common.tab.reports") },
] as const;

type Section = (typeof TABS)[number]["key"];

/**
 * The five fleet-scoped sections, verbatim from the deleted `/fleets/[id]` route.
 * The tab bar is local state, exactly as it was there — the fleet-owner screen is a
 * single page now, so there is no route segment left to key a tab off.
 */
export function FleetSections({ fleetId, defaultSection }: { fleetId: string; defaultSection?: Section }) {
  const [section, setSection] = useState<Section>(defaultSection ?? "buses");

  return (
    <div className="space-y-4">
      <nav aria-label={tr("fleetOwners.fleets.detail.tabsAria")} className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSection(tab.key)}
            aria-current={section === tab.key ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${section === tab.key ? "bg-[#059ff8] text-white" : "bg-white text-[#1a1a1a] hover:bg-[#d6eeff]"}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {section === "buses" && <FleetBusesTab fleetId={fleetId} />}
      {section === "members" && <MembersTab fleetId={fleetId} />}
      {section === "trips" && <FleetTripsTab fleetId={fleetId} />}
      {section === "bookings" && <FleetBookingsTab fleetId={fleetId} />}
      {section === "reports" && <FleetReportsTab fleetId={fleetId} />}
    </div>
  );
}
