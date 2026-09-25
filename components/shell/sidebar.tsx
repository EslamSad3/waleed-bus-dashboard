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

const NAV = [
  { href: "/", label: "نظرة عامة", icon: LayoutDashboard },
  { href: "/fleet-owners", label: "ملاك الأساطيل", icon: UserRoundCog },
  { href: "/fleets", label: "الأساطيل", icon: Building2 },
  { href: "/drivers", label: "السواقين", icon: Users },
  { href: "/buses", label: "الأتوبيسات", icon: Bus },
  { href: "/brands", label: "ماركات الأتوبيسات", icon: Bus },
  { href: "/vip-tiers", label: "مستويات VIP", icon: Bus },
  { href: "/markaz", label: "المراكز", icon: MapPin },
  { href: "/localities", label: "المدن والقرى", icon: MapPin },
  { href: "/stops", label: "نقاط التوقف", icon: MapPin },
  { href: "/trip-lines", label: "خطوط الرحلات", icon: Route },
  { href: "/trips", label: "الرحلات", icon: Route },
  { href: "/bookings", label: "الحجوزات", icon: Ticket },
  { href: "/promotions", label: "أكواد الخصم", icon: Ticket },
  { href: "/notifications", label: "الإشعارات", icon: Ticket },
  { href: "/service-config", label: "خدمة العملاء والإعلانات", icon: Ticket },
  { href: "/users", label: "مستخدمو الإدارة", icon: Users },
  { href: "/reports", label: "التقارير", icon: ChartNoAxesCombined },
  { href: "/roles", label: "مستويات الوصول", icon: UserRoundCog },
  { href: "/permissions", label: "دليل المهام", icon: KeyRound },
] as const;

export function Sidebar() {
  const active = usePathname();
  const links = NAV.map(({ href, label, icon: Icon }) => {
    const isActive = active === href || (href !== "/" && active.startsWith(`${href}/`));
    return (
      <Link
        key={href}
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group flex shrink-0 items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold text-slate-600 transition-all hover:bg-[#edf6fc] hover:text-[#204c6b]",
          isActive && "bg-[#daeaf5] text-[#204c6b] shadow-[inset_0_0_0_1px_rgba(47,113,158,.08)]",
        )}
      >
        <span
          className={cn(
            "grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-white group-hover:text-[#2f719e]",
            isActive && "bg-white text-[#2f719e] shadow-sm",
          )}
        >
          <Icon aria-hidden="true" className="size-[18px]" />
        </span>
        <span>{label}</span>
      </Link>
    );
  });

  return (
    <>
      <aside
        aria-label="التنقل الرئيسي"
        className="sticky top-24 hidden h-[calc(100vh-7rem)] w-64 shrink-0 flex-col rounded-[1.75rem] border border-white/80 bg-white/75 p-3 shadow-[0_18px_55px_rgba(29,64,89,.08)] backdrop-blur-xl md:flex"
      >
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-[#10153c] px-4 py-3 text-white">
          <Sparkles className="size-4 text-[#9ed0f0]" aria-hidden="true" />
          <span className="text-xs font-bold">مساحة الإدارة</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">{links}</nav>
        <div className="mt-3 rounded-2xl bg-[#fff7e3] p-3 text-xs leading-6 text-[#5e6b78]">
          إدارة الملاك والسواقين والأتوبيسات من مكان واحد.
        </div>
      </aside>

      <nav
        aria-label="التنقل الرئيسي للموبايل"
        className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto border-y border-slate-200/70 bg-white/80 px-4 py-2 backdrop-blur-xl md:hidden"
      >
        {links}
      </nav>
    </>
  );
}
