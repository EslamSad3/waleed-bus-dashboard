import { apiGet, apiSend, type ActionResult, type CursorPage } from "@/lib/actions/http";
import { notifyResult } from "@/lib/actions/toast";


export type OpsNotification = {
  id: string;
  userId: string;
  category: string;
  title: string;
  body?: string | null;
  tripId?: string | null;
  promotionId?: string | null;
  isRead: boolean;
  createdAt: string;
  user?: {
    id: string;
    name?: string | null;
    phoneNumber?: string | null;
  } | null;
};

export function fetchOpsNotifications(params?: {
  userId?: string;
  category?: string;
}): Promise<ActionResult<CursorPage<OpsNotification>>> {
  const search = new URLSearchParams();
  if (params?.userId) search.set("userId", params.userId);
  if (params?.category) search.set("category", params.category);
  const qs = search.toString();
  return apiGet(`/api/platform/notifications${qs ? `?${qs}` : ""}`);
}

export type SendNotificationInput = {
  userId?: string | null;
  isGlobal?: boolean;
  category?: "TEXT" | "TRIP" | "DISCOUNT_CODE";
  title: string;
  body: string;
  tripId?: string | null;
  promotionId?: string | null;
};

export type SendNotificationResult = {
  sentCount: number;
  isGlobal: boolean;
  notificationIds: string[];
  /**
   * Push dispatch outcome, reported separately from the inbox count:
   * `sentCount` is rows saved in PostgreSQL, `acceptedDeviceCount` is device
   * submissions FCM accepted (NOT proof that a device displayed anything).
   */
  push: PushSummary;
};

export type PushSummary = {
  status: "disabled" | "completed" | "incomplete";
  acceptedDeviceCount: number;
  failedDeviceCount: number;
  skippedUserCount: number;
};

/**
 * `sentCount` (inbox rows) and the push counts are deliberately reported
 * separately: merging them would imply a delivery guarantee that FCM does not
 * make. `incomplete` means processing stopped early, so the device counts are
 * partial. The copy lives in the dictionary — see `describePushSummary` in
 * `components/notifications/push-summary.ts`.
 */


export function sendPlatformNotification(
  input: SendNotificationInput,
): Promise<ActionResult<SendNotificationResult>> {
  // `notify: false` on purpose: the send dialog renders one composed result
  // banner that already carries the inbox count AND the Firebase acceptance /
  // failure / skipped counts. A second generic toast here would restate
  // "sent successfully" without the counts and read as a duplicate.
  return notifyResult("", apiSend("/api/platform/notifications", "POST", input), {
    notify: false,
  });
}
