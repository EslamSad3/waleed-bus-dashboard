"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ApexOptions } from "apexcharts";
import {
  Building2,
  BusFront,
  MapPin,
  Route,
  TicketCheck,
  UserRoundCog,
  Users,
  UsersRound,
  Waypoints,
} from "lucide-react";
import { apiGet, mapWithConcurrency, type CursorPage } from "@/lib/actions/http";
import { fetchAdminBookingsPage, type Booking } from "@/lib/actions/bookings";
import { fetchStops, fetchTripLines, type Stop, type TripLine } from "@/lib/actions/trip-lines";
import { qk, useApiQuery, useDataQuery } from "@/lib/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCardsSkeleton } from "@/components/ui/skeletons";
import { ApexChart } from "@/components/charts/apex-chart";
import { t } from "@/lib/i18n/t";

type FleetLite = { id: string; name: string; isActive: boolean };

async function fetchCountPage(path: string): Promise<number> {
  const result = await apiGet<CursorPage<unknown>>(path);
  if (!result.ok) throw new Error(result.message);
  return result.data.items.length;
}

/** عدّاد لكل أسطول من مصدر معين (عربيات/رحلات) */
async function countPerFleet(fleets: FleetLite[], resource: "buses" | "trips") {
  return mapWithConcurrency(fleets.slice(0, 12), 4, async (fleet) => {
    const result = await apiGet<CursorPage<unknown>>(`/api/fleets/${fleet.id}/${resource}?limit=100`);
    return { name: fleet.name, count: result.ok ? result.data.items.length : 0 };
  });
}

type Kpi = {
  label: string;
  value: number | string;
  href: string;
  icon: typeof BusFront;
  tint: string;
};

function KpiCard({ label, value, href, icon: Icon, tint }: Kpi) {
  return (
    <Link
      href={href}
      className="panel-card group flex min-w-0 items-center gap-3 p-4 transition-transform duration-200 hover:-translate-y-1 sm:gap-4 sm:p-5"
    >
      <span className={`grid size-11 shrink-0 place-items-center rounded-2xl sm:size-12 ${tint}`}>
        <Icon className="size-5 sm:size-6" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        {/* النص الكامل بيلف على سطرين بدل القص */}
        <p className="text-[11px] font-bold leading-snug text-[#5e6b78] sm:text-xs">{label}</p>
        <p className="text-xl font-extrabold text-[#00134c] sm:text-2xl" dir="ltr">
          {value}
        </p>
      </div>
      <ArrowLeft className="size-4 shrink-0 text-[#8b98a5] transition-transform group-hover:-translate-x-1 group-hover:text-[#059ff8]" aria-hidden="true" />
    </Link>
  );
}

/** كروت مؤشرات (كل كارت لينك لصفحته) + رسوم ApexCharts ثلاثية الإحساس. */
export function OverviewInsights() {
  const fleetsQuery = useDataQuery<FleetLite[]>(["fleets", "kpi"], async () => {
    const result = await apiGet<CursorPage<FleetLite>>("/api/fleets?limit=100");
    if (!result.ok) throw new Error(result.message);
    return result.data.items;
  });
  const driversQuery = useDataQuery<number>(["drivers", "kpi"], () => fetchCountPage("/api/drivers?limit=100"));
  const ownersQuery = useDataQuery<number>(["fleet-owners", "kpi"], () => fetchCountPage("/api/fleet-owners?limit=100"));
  const usersQuery = useDataQuery<number>(["users", "kpi"], () => fetchCountPage("/api/users?limit=100"));
  const stopsQuery = useApiQuery<Stop[]>(qk.stops, fetchStops);
  const tripLinesQuery = useApiQuery<TripLine[]>(qk.tripLines, fetchTripLines);
  const bookingsQuery = useDataQuery<Booking[]>(["bookings", "kpi"], async () => {
    const result = await fetchAdminBookingsPage({ limit: 100 }, null);
    if (!result.ok) throw new Error(result.message);
    return result.data.items;
  });
  const busesPerFleetQuery = useDataQuery<{ name: string; count: number }[]>(
    ["buses", "per-fleet", fleetsQuery.data?.length ?? 0],
    () => countPerFleet(fleetsQuery.data ?? [], "buses"),
    { enabled: Boolean(fleetsQuery.data) },
  );
  const tripsPerFleetQuery = useDataQuery<{ name: string; count: number }[]>(
    ["trips", "per-fleet", fleetsQuery.data?.length ?? 0],
    () => countPerFleet(fleetsQuery.data ?? [], "trips"),
    { enabled: Boolean(fleetsQuery.data) },
  );

  const fleets = fleetsQuery.data ?? [];
  const activeFleets = fleets.filter((fleet) => fleet.isActive).length;
  const totalBuses = (busesPerFleetQuery.data ?? []).reduce((sum, row) => sum + row.count, 0);
  const totalTrips = (tripsPerFleetQuery.data ?? []).reduce((sum, row) => sum + row.count, 0);
  const bookings = bookingsQuery.data ?? [];
  const statusCount = (status: string) => bookings.filter((booking) => booking.status === status).length;
  const loadingText = "…";

  const kpis: Kpi[] = [
    {
      label: t("home.insights.activeFleets"),
      value: fleetsQuery.isLoading ? loadingText : `${activeFleets} / ${fleets.length}`,
      href: "/fleets",
      icon: Building2,
      tint: "bg-[#f0edff] text-[#5d4ca8]",
    },
    {
      label: t("common.nav.buses"),
      value: busesPerFleetQuery.isLoading ? loadingText : totalBuses,
      href: "/buses",
      icon: BusFront,
      tint: "bg-[#e9f7f0] text-[#147353]",
    },
    {
      label: t("common.nav.trips"),
      value: tripsPerFleetQuery.isLoading ? loadingText : totalTrips,
      href: "/trips",
      icon: Route,
      tint: "bg-[#eaf6ff] text-[#059ff8]",
    },
    {
      label: t("common.nav.tripLines"),
      value: tripLinesQuery.isLoading ? loadingText : tripLinesQuery.data?.length ?? loadingText,
      href: "/trip-lines",
      icon: Waypoints,
      tint: "bg-[#fff7e3] text-[#8b6814]",
    },
    {
      label: t("common.nav.stops"),
      value: stopsQuery.isLoading ? loadingText : stopsQuery.data?.length ?? loadingText,
      href: "/stops",
      icon: MapPin,
      tint: "bg-[#e9f7f0] text-[#147353]",
    },
    {
      label: t("common.nav.drivers"),
      value: driversQuery.isLoading ? loadingText : driversQuery.data ?? loadingText,
      href: "/drivers",
      icon: UsersRound,
      tint: "bg-[#f3e8ff] text-[#7c3aed]",
    },
    {
      label: t("common.nav.fleetOwners"),
      value: ownersQuery.isLoading ? loadingText : ownersQuery.data ?? loadingText,
      href: "/fleet-owners",
      icon: UserRoundCog,
      tint: "bg-[#eaf6ff] text-[#059ff8]",
    },
    {
      label: t("common.nav.adminUsers"),
      value: usersQuery.isLoading ? loadingText : usersQuery.data ?? loadingText,
      href: "/users",
      icon: Users,
      tint: "bg-[#f0edff] text-[#5d4ca8]",
    },
    {
      label: t("home.insights.confirmedBookings"),
      value: bookingsQuery.isLoading ? loadingText : statusCount("CONFIRMED"),
      href: "/bookings",
      icon: TicketCheck,
      tint: "bg-[#e9f7f0] text-[#147353]",
    },
  ];

  const baseOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        fontFamily: "var(--font-cairo), sans-serif",
        foreColor: "#5e6b78",
        toolbar: { show: false },
        zoom: { enabled: false },
        dropShadow: { enabled: true, top: 6, left: 0, blur: 6, opacity: 0.14 },
      },
      legend: { position: "bottom", fontWeight: 700 },
      dataLabels: { enabled: false },
    }),
    [],
  );

  const donutOptions = useMemo<ApexOptions>(
    () => ({
      ...baseOptions,
      labels: [t("enums.bookingStatus.confirmedChart"), t("enums.bookingStatus.completedChart"), t("enums.bookingStatus.cancelledChart")],
      colors: ["#059ff8", "#16a34a", "#dc2626"],
      stroke: { width: 0 },
      plotOptions: {
        pie: {
          donut: {
            size: "68%",
            labels: {
              show: true,
              name: { fontSize: "14px", fontWeight: 700 },
              value: { fontSize: "26px", fontWeight: 800, color: "#00134c" },
              total: { show: true, label: t("home.insights.chartTotal"), fontSize: "13px", fontWeight: 700 },
            },
          },
        },
      },
    }),
    [baseOptions],
  );

  const radialOptions = useMemo<ApexOptions>(
    () => ({
      ...baseOptions,
      labels: [t("home.insights.chartOperatingRate")],
      colors: ["#059ff8"],
      plotOptions: {
        radialBar: {
          hollow: { size: "58%" },
          track: { background: "#e2eef7" },
          dataLabels: {
            name: { fontSize: "14px", fontWeight: 700 },
            value: { fontSize: "26px", fontWeight: 800, color: "#00134c" },
          },
        },
      },
    }),
    [baseOptions],
  );

  const barOptions = useMemo<ApexOptions>(
    () => ({
      ...baseOptions,
      colors: ["#00134c", "#059ff8"],
      plotOptions: {
        bar: {
          borderRadius: 9,
          borderRadiusApplication: "end",
          columnWidth: "48%",
          distributed: true,
        },
      },
      xaxis: {
        categories: (busesPerFleetQuery.data ?? []).map((row) => row.name),
        labels: { trim: true, hideOverlappingLabels: true },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: { labels: { formatter: (value) => String(Math.round(value)) } },
      grid: { border: { dashed: true }, strokeDashArray: 4 },
    }),
    [baseOptions, busesPerFleetQuery.data],
  );

  const fleetRunningPercent = fleets.length
    ? Math.round((activeFleets / fleets.length) * 100)
    : 0;
  const chartFrame = "panel-card p-5 sm:p-6";

  const hasData =
    !fleetsQuery.isLoading && !bookingsQuery.isLoading && !busesPerFleetQuery.isLoading;

  // أول تحميل لصف الكروت — سكيليتون بنفس شبكة البيانات (بدون قفزة).
  // isLoading يعني isPending + قيد الجلب، فالاستعلامات المعطّلة (المتوقفة على الأساطيل)
  // أو فاشلة أو مأخوذة من الكاش ما بتعطّل الصف.
  const kpisLoading = [
    fleetsQuery,
    driversQuery,
    ownersQuery,
    usersQuery,
    stopsQuery,
    tripLinesQuery,
    bookingsQuery,
    busesPerFleetQuery,
    tripsPerFleetQuery,
  ].some((query) => query.isLoading);

  return (
    <section className="dashboard-page">
      <div className="page-heading">
        <div className="min-w-0 flex-1">
          <h2 className="page-title text-[1.35rem] sm:text-2xl">{t("home.insights.title")}</h2>
          <p className="page-description">{t("home.insights.description")}</p>
        </div>
      </div>

      {/* ٩ كروت — شبكة ٣ أعمدة متزنة من غير خانة فاضية */}
      {kpisLoading ? (
        <KpiCardsSkeleton count={kpis.length} columns={3} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>
      )}

      {hasData ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className={chartFrame}>
            <h3 className="mb-2 text-base font-extrabold text-[#00134c]">{t("home.insights.bookingsStatusTitle")}</h3>
            <ApexChart
              type="donut"
              options={donutOptions}
              series={[statusCount("CONFIRMED"), statusCount("COMPLETED"), statusCount("CANCELLED")]}
              height={280}
            />
          </div>
          <div className={chartFrame}>
            <h3 className="mb-2 text-base font-extrabold text-[#00134c]">{t("home.insights.fleetsOperatingTitle")}</h3>
            <ApexChart
              type="radialBar"
              options={radialOptions}
              series={[fleetRunningPercent]}
              height={280}
            />
          </div>
          <div className={chartFrame}>
            <h3 className="mb-2 text-base font-extrabold text-[#00134c]">{t("home.insights.busesPerFleetTitle")}</h3>
            <ApexChart
              type="bar"
              options={barOptions}
              series={[{ name: t("home.insights.busesSeries"), data: (busesPerFleetQuery.data ?? []).map((row) => row.count) }]}
              height={280}
            />
          </div>
        </div>
      ) : (
        <div role="status" className="grid gap-4 xl:grid-cols-3">
          <span className="sr-only">{t("common.loading.more")}</span>
          {[0, 1, 2].map((index) => (
            <div key={index} className={`${chartFrame} space-y-3`}>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-[280px] w-full" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
