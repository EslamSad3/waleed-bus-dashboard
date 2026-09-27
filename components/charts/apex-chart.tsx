"use client";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { Skeleton } from "@/components/ui/skeleton";

// ApexCharts يلمس window وقت الاستيراد — بيتحمّل من غير SSR
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  // أثناء تحميل حزمة الرسم: سكيليتون بنفس مقاس الصندوق المحجوز — بدون قفزة
  loading: () => <Skeleton className="h-full w-full" />,
});

type ApexChartProps = {
  type: "donut" | "radialBar" | "bar";
  options: ApexOptions;
  series: ApexOptions["series"];
  height?: number;
};

/** غلاف ApexCharts للعميل — ظلال وتدرجات تعطي إحساس ثلاثي الأبعاد. */
export function ApexChart({ type, options, series, height = 260 }: ApexChartProps) {
  return (
    <div className="w-full" style={{ height }}>
      <ReactApexChart
        type={type}
        options={options}
        series={series}
        height={height}
        width="100%"
      />
    </div>
  );
}
