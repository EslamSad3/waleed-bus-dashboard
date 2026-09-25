import { apiGet, apiSend, type ActionResult, type CursorPage } from "@/lib/actions/http";

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
};

export function sendPlatformNotification(
  input: SendNotificationInput,
): Promise<ActionResult<SendNotificationResult>> {
  return apiSend("/api/platform/notifications", "POST", input);
}
