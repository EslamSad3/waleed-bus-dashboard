"use client";

import { DriverAssignmentsPage } from "@/components/owners/driver-sub-pages";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <DriverAssignmentsPage params={params} />;
}
