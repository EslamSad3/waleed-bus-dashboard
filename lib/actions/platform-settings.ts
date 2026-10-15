import { apiGet, apiSend, type ActionResult } from "@/lib/actions/http";
import { notifyResult } from "@/lib/actions/toast";
import { t } from "@/lib/i18n/t";

export type PlatformSettings = {
  /** Longest passenger trip-search range (dateFrom..dateTo, both included), in days. */
  maxSearchDays: number;
  /** Default max seats a passenger can book per trip if not individually overridden. */
  maxSeats: number;
  updatedAt: string | null;
};

export function fetchPlatformSettings(): Promise<ActionResult<PlatformSettings>> {
  return apiGet("/api/platform/settings");
}

export function updatePlatformSettings(input: {
  maxSearchDays: number;
  maxSeats: number;
}): Promise<ActionResult<PlatformSettings>> {
  return notifyResult(t("settings.toast.saved"), apiSend("/api/platform/settings", "PATCH", input));
}
