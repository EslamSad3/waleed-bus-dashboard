"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bus,
  Route,
  MapPin,
  Ticket,
  Users,
  Building2,
  UserRoundCog,
  KeyRound,
  ChartNoAxesCombined,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/t";

const NAV = [
  { href: "/", label: t("common.nav.overview"), icon: LayoutDashboard },
  { href: "/fleet-owners", label: t("common.nav.fleetOwners"), icon: UserRoundCog },
  { href: "/fleets", label: t("common.nav.fleets"), icon: Building2 },
  { href: "/drivers", label: t("common.nav.drivers"), icon: Users },
  { href: "/buses", label: t("common.nav.buses"), icon: Bus },
  { href: "/brands", label: t("common.nav.brands"), icon: Bus },
  { href: "/vip-tiers", label: t("common.nav.vipTiers"), icon: Bus },
  { href: "/markaz", label: t("common.nav.markaz"), icon: MapPin },
  { href: "/localities", label: t("common.nav.localities"), icon: MapPin },
  { href: "/stops", label: t("common.nav.stops"), icon: MapPin },
  { href: "/trip-lines", label: t("common.nav.tripLines"), icon: Route },
  { href: "/trips", label: t("common.nav.trips"), icon: Route },
  { href: "/bookings", label: t("common.nav.bookings"), icon: Ticket },
  { href: "/promotions", label: t("common.nav.promotions"), icon: Ticket },
  { href: "/notifications", label: t("common.nav.notifications"), icon: Ticket },
  { href: "/service-config", label: t("common.nav.serviceConfig"), icon: Ticket },
  { href: "/users", label: t("common.nav.adminUsers"), icon: Users },
  { href: "/reports", label: t("common.nav.reports"), icon: ChartNoAxesCombined },
  { href: "/roles", label: t("common.nav.roles"), icon: UserRoundCog },
  { href: "/permissions", label: t("common.nav.permissions"), icon: KeyRound },
] as const;

/** Shared nav links used by the desktop aside and the mobile off-canvas drawer. */
export function SidebarLinks() {
  const active = usePathname();
  return (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
        const isActive = active === href || (href !== "/" && active.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group flex shrink-0 items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold text-slate-600 transition-all hover:bg-[#eaf6ff] hover:text-[#00134c]",
              isActive && "bg-[#d6eeff] text-[#00134c] shadow-[inset_0_0_0_1px_rgba(5,159,248,.12)]",
            )}
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-white group-hover:text-[#059ff8]",
                isActive && "bg-white text-[#059ff8] shadow-sm",
              )}
            >
              <Icon aria-hidden="true" className="size-[18px]" />
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </>
  );
}

/** Desktop sidebar (md and up). On phones the drawer in `mobile-nav.tsx` takes over. */
export function Sidebar() {
  return (
    <aside
      aria-label={t("shell.nav.mainAria")}
      className="sticky top-24 hidden h-[calc(100vh-7rem)] w-64 shrink-0 flex-col rounded-[1.75rem] border border-white/80 bg-white/75 p-3 shadow-[0_18px_55px_rgba(29,64,89,.08)] backdrop-blur-xl md:flex"
    >
      <div className="mb-3 flex items-center gap-2 rounded-2xl bg-[#00134c] px-4 py-3 text-white">
        <Sparkles className="size-4 text-[#9ed0f0]" aria-hidden="true" />
        <span className="text-xs font-bold">{t("shell.nav.adminArea")}</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        <SidebarLinks />
      </nav>
      <div className="mt-3 rounded-2xl bg-[#fff7e3] p-3 text-xs leading-6 text-[#5e6b78]">
        {t("shell.nav.tagline")}
      </div>
    </aside>
  );
}
