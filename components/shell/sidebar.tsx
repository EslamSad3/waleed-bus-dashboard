import Link from "next/link";
import {
  LayoutDashboard,
  Bus,
  Route,
  Ticket,
  Users,
  ShieldCheck,
  FileText,
  ScrollText,
  Settings,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "نظرة عامة", icon: LayoutDashboard },
  { href: "/fleets", label: "الأساطيل", icon: Building2 },
  { href: "/buses", label: "الأتوبيسات", icon: Bus },
  { href: "/trips", label: "الرحلات", icon: Route },
  { href: "/bookings", label: "الحجوزات", icon: Ticket },
  { href: "/drivers", label: "السواقين والملاك", icon: Users },
  { href: "/users", label: "المستخدمين", icon: Users },
  { href: "/roles", label: "الأدوار والصلاحيات", icon: ShieldCheck },
  { href: "/reports", label: "التقارير", icon: FileText },
  { href: "/audit", label: "سجل التدقيق", icon: ScrollText },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];

export function Sidebar({ active }: { active: string }) {
  return (
    <aside aria-label="التنقل الرئيسي" className="hidden w-64 shrink-0 flex-col gap-1 p-4 md:flex">
      {NAV.map(({ href, label, icon: Icon }) => {
        const isActive = active === href || (href !== "/" && active.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-[#1a1a1a] transition-colors hover:bg-[#daeaf5]",
              isActive && "bg-[#daeaf5] text-[#2f719e]",
            )}
          >
            <Icon aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}
