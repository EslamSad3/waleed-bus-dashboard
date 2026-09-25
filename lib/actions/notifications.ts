import { apiGet, type ActionResult, type CursorPage } from "@/lib/actions/http";

export type OpsNotification = {
  id: string;
  userId: string;
  category: string;
  title: string;
  isRead: boolean;
  createdAt: string;
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
