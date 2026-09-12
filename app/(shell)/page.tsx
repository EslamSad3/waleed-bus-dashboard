import Link from "next/link";
import { Button } from "@/components/ui/button";

const KPIS = [
  { label: "الأساطيل", value: "—", tint: "amber" },
  { label: "الأتوبيسات", value: "—", tint: "blue" },
  { label: "رحلات شغالة", value: "—", tint: "amber" },
  { label: "حجوزات النهاردة", value: "—", tint: "blue" },
] as const;

export default function OverviewPage() {
  return (
    <div className="space-y-6 px-2">
      <div>
        <h1 className="title-grad text-3xl font-extrabold">لوحة تحكم منصة الأتوبيسات</h1>
        <p className="mt-1 text-sm text-[#606060]">
          إدارة الأساطيل والأتوبيسات والرحلات والحجوزات من مكان واحد
        </p>
      </div>

      <section aria-label="مؤشرات" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {KPIS.map((kpi) => (
          <div
            key={kpi.label}
            className={
              kpi.tint === "amber"
                ? "rounded-2xl bg-[#fff7e3] p-5"
                : "rounded-2xl bg-[#daeaf5] p-5"
            }
          >
            <div className="text-sm text-[#606060]">{kpi.label}</div>
            <div className="mt-1 text-3xl font-bold text-[#1a1a1a]">{kpi.value}</div>
          </div>
        ))}
      </section>

      <section aria-label="اختصارات" className="navy-band rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold">ابدأ من هنا</h2>
        <p className="mt-1 text-sm text-slate-200">
          التقارير والملخصات بتتولد PDF بالعربي من صفحة التقارير
        </p>
        <div className="mt-4 flex gap-3">
          <Link href="/reports" aria-label="روح للتقارير">
            <Button variant="secondary">التقارير</Button>
          </Link>
          <Link href="/fleets" aria-label="روح للأساطيل">
            <Button
              variant="outline"
              className="border-white text-white hover:bg-white/10 hover:text-white"
            >
              الأساطيل
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
