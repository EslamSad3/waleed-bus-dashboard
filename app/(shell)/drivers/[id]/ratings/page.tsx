"use client";

import { DriverRatingsPage } from "@/components/owners/driver-sub-pages";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <DriverRatingsPage params={params} />;
}
