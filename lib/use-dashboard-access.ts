"use client";

import { fetchSessionIdentity } from "@/lib/actions/session";
import { qk, useApiQuery } from "@/lib/queries";

/** Share the existing session query; controls fail closed while it is loading. */
export function useDashboardAccess() {
  const { data } = useApiQuery(qk.session, fetchSessionIdentity);
  return data ?? null;
}
