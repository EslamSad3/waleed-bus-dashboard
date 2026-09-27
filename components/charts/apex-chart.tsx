"use client";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

// ApexCharts يلمس window وقت الاستيراد — بيتحمّل من غير SSR
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

type ApexChartProps = {
  type: "donut" | "radialBar" | "bar";
  options: ApexOptions;
  series: ApexOptions["series"];
  height?: number;
};

/** غلاف ApexCharts للعميل — ظلال وتدرجات تعطي إحساس ثلاثي الأبعاد. */
export function ApexChart({ type, options, series, height = 260 }: ApexChartProps) {
  return <ReactApexChart type={type} options={options} series={series} height={height} />;
}
