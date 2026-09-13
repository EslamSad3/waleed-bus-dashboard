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

const MODULES = [
  {
    href: "/fleet-owners",
    createHref: "/fleet-owners/new",
    title: "ملاك الأساطيل",
    description: "أنشئ حساب المالك والأسطول الأول والعضوية في خطوة واحدة.",
    action: "إضافة مالك",
    icon: UserRoundCog,
    tint: "bg-[#edf6fc] text-[#2f719e]",
  },
  {
    href: "/drivers",
    createHref: "/drivers/new",
    title: "السواقين",
    description: "أنشئ حسابات السواقين وتابع العضوية وسجل التعيينات.",
    action: "إضافة سواق",
    icon: UsersRound,
    tint: "bg-[#fff7e3] text-[#8b6814]",
  },
  {
    href: "/buses",
    createHref: "/buses/new",
    title: "الأتوبيسات",
    description: "أضف الأتوبيسات وغيّر حالتها وعيّن السواق المناسب.",
    action: "إضافة أتوبيس",
    icon: BusFront,
    tint: "bg-[#e9f7f0] text-[#147353]",
  },
  {
    href: "/fleets",
    createHref: "/fleets/new",
    title: "الأساطيل",
    description: "راجع كل الأساطيل وبياناتها وأعضائها وتشغيلها.",
    action: "إضافة أسطول",
    icon: Building2,
    tint: "bg-[#f0edff] text-[#5d4ca8]",
  },
] as const;

const OPERATIONS = [
  { href: "/trips", label: "الرحلات", description: "جدولة ومتابعة التشغيل", icon: Route },
  { href: "/bookings", label: "الحجوزات", description: "إدارة الركاب والمقاعد", icon: TicketCheck },
] as const;

export default function OverviewPage() {
  return (
    <div className="dashboard-page">
      <section className="navy-band relative overflow-hidden rounded-[2rem] px-5 py-7 text-white shadow-[0_22px_60px_rgba(16,21,60,.2)] sm:px-8 sm:py-9">
        <div className="absolute -left-16 -top-20 size-64 rounded-full border border-white/10" />
        <div className="absolute -left-5 -top-10 size-40 rounded-full border border-white/10" />
        <div className="relative max-w-3xl">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-[#d9efff]">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            مركز التشغيل جاهز
          </span>
          <h1 className="text-2xl font-extrabold leading-tight sm:text-4xl">
            كل عمليات النقل في لوحة واحدة واضحة
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
            أنشئ المالك والسواق، جهّز الأسطول والأتوبيس، وبعدها عيّن السواق وابدأ التشغيل.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-white text-[#10153c] shadow-none hover:bg-[#edf6fc]">
              <Link href="/fleet-owners/new">إنشاء مالك أسطول</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link href="/drivers/new">إضافة سواق</Link>
            </Button>
          </div>
        </div>
      </section>

      <section>
        <div className="page-heading mb-4">
          <div>
            <h2 className="page-title text-[1.35rem] sm:text-2xl">إدارة الحسابات والأسطول</h2>
            <p className="page-description">الوظائف الأساسية المتاحة حاليًا في النظام.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MODULES.map(({ href, createHref, title, description, action, icon: Icon, tint }) => (
            <article key={href} className="panel-card group flex min-h-64 flex-col p-5 transition-transform duration-200 hover:-translate-y-1">
              <span className={`grid size-12 place-items-center rounded-2xl ${tint}`}>
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-extrabold text-[#17212b]">{title}</h3>
              <p className="mt-2 flex-1 text-sm leading-7 text-[#5e6b78]">{description}</p>
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <Link href={href} className="text-xs font-bold text-[#5e6b78] hover:text-[#2f719e]">
                  عرض الكل
                </Link>
                <Link href={createHref} className="inline-flex items-center gap-1 text-xs font-extrabold text-[#2f719e]">
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
          <h2 className="text-lg font-extrabold text-[#204c6b]">التشغيل اليومي</h2>
          <p className="mt-1 text-sm text-[#5e6b78]">انتقل مباشرة لإدارة الرحلات والحجوزات.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPERATIONS.map(({ href, label, description, icon: Icon }) => (
            <Link key={href} href={href} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-[#f8fbfd] p-4 transition hover:border-[#a9cce3] hover:bg-[#edf6fc]">
              <span className="grid size-11 place-items-center rounded-xl bg-white text-[#2f719e] shadow-sm">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold text-[#17212b]">{label}</span>
                <span className="text-xs text-[#5e6b78]">{description}</span>
              </span>
              <ArrowLeft className="size-4 text-[#8b98a5] transition-transform group-hover:-translate-x-1 group-hover:text-[#2f719e]" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
