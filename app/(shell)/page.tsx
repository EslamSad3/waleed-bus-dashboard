import Link from "next/link";
import {
  ArrowLeft,
  BusFront,
  Building2,
  CheckCircle2,
  Route,
  TicketCheck,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OverviewInsights } from "@/components/home/overview-insights";
import { t } from "@/lib/i18n/t";

const MODULES = [
  {
    href: "/fleet-owners",
    title: t("common.nav.fleetOwners"),
    description: t("home.modules.fleetOwners.description"),
    action: t("fleetOwners.newOwner"),
    icon: Building2,
    tint: "bg-[#eaf6ff] text-[#059ff8]",
  },
  {
    href: "/drivers",
    title: t("common.nav.drivers"),
    description: t("home.modules.drivers.description"),
    action: t("common.actions.addDriver"),
    icon: UsersRound,
    tint: "bg-[#fff7e3] text-[#8b6814]",
  },
  {
    href: "/buses",
    title: t("common.nav.buses"),
    description: t("home.modules.buses.description"),
    action: t("common.actions.addBus"),
    icon: BusFront,
    tint: "bg-[#e9f7f0] text-[#147353]",
  },
] as const;

const OPERATIONS = [
  { href: "/trips", label: t("common.nav.trips"), description: t("home.operations.trips"), icon: Route },
  { href: "/bookings", label: t("common.nav.bookings"), description: t("home.operations.bookings"), icon: TicketCheck },
] as const;

export default function OverviewPage() {
  return (
    <div className="dashboard-page">
      <section className="navy-band relative overflow-hidden rounded-[2rem] px-5 py-7 text-white shadow-[0_22px_60px_rgba(0,19,76,.22)] sm:px-8 sm:py-9">
        <div className="absolute -start-16 -top-20 size-64 rounded-full border border-white/10" />
        <div className="absolute -start-5 -top-10 size-40 rounded-full border border-white/10" />
        <div className="relative max-w-3xl">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-[#d9efff]">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {t("home.hero.badge")}
          </span>
          <h1 className="text-2xl font-extrabold leading-tight sm:text-4xl">
            {t("home.hero.title")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
            {t("home.hero.description")}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-white text-[#00134c] shadow-none hover:bg-[#eaf6ff]">
              <Link href="/fleet-owners">{t("home.hero.ctaCreateOwner")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link href="/drivers">{t("common.actions.addDriver")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <OverviewInsights />

      <section>
        <div className="page-heading mb-4">
          <div className="min-w-0 flex-1">
            <h2 className="page-title text-[1.35rem] sm:text-2xl">{t("home.modulesTitle")}</h2>
            <p className="page-description">{t("home.modulesDescription")}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MODULES.map(({ href, title, description, action, icon: Icon, tint }) => (
            <article key={href} className="panel-card group flex min-h-64 flex-col p-5 transition-transform duration-200 hover:-translate-y-1">
              <span className={`grid size-12 place-items-center rounded-2xl ${tint}`}>
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-extrabold text-[#17212b]">{title}</h3>
              <p className="mt-2 flex-1 text-sm leading-7 text-[#5e6b78]">{description}</p>
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <Link href={href} className="text-xs font-bold text-[#5e6b78] hover:text-[#059ff8]">
                  {t("common.actions.viewAll")}
                </Link>
                <Link href={href} className="inline-flex items-center gap-1 text-xs font-extrabold text-[#059ff8]">
                  {action}
                  <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-card p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-extrabold text-[#00134c]">{t("home.dailyOpsTitle")}</h2>
          <p className="mt-1 text-sm text-[#5e6b78]">{t("home.dailyOpsDescription")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPERATIONS.map(({ href, label, description, icon: Icon }) => (
            <Link key={href} href={href} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-[#f8fbfd] p-4 transition hover:border-[#8fd2ff] hover:bg-[#eaf6ff]">
              <span className="grid size-11 place-items-center rounded-xl bg-white text-[#059ff8] shadow-sm">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold text-[#17212b]">{label}</span>
                <span className="text-xs text-[#5e6b78]">{description}</span>
              </span>
              <ArrowLeft className="size-4 text-[#8b98a5] transition-transform group-hover:-translate-x-1 group-hover:text-[#059ff8]" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
