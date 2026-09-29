"use client";

import { DriverTripsPage } from "@/components/owners/driver-sub-pages";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <DriverTripsPage params={params} />;
}
