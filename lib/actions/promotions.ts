import { apiGet, apiSend, type ActionResult, type CursorPage } from "@/lib/actions/http";

export type Promotion = {
  id: string;
  code: string;
  type: "FIXED";
  value: string;
  isGlobal: boolean;
  maxUsesPerUser: number;
  maxTotalUses: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
};

export type PromotionUsage = {
  id: string;
  userId: string;
  bookingId: string;
  discountAmount: string;
  createdAt: string;
};

export type CreatePromotionInput = {
  code: string;
  type: "FIXED";
  value: number;
  isGlobal?: boolean;
  targetUserIds?: string[];
  maxUsesPerUser?: number;
  maxTotalUses?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
};

export type UpdatePromotionInput = {
  value?: number;
  maxUsesPerUser?: number;
  maxTotalUses?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
};

export function fetchPromotions(cursor?: string): Promise<ActionResult<CursorPage<Promotion>>> {
  return apiGet(`/api/platform/promotions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
}

export function createPromotion(input: CreatePromotionInput): Promise<ActionResult<Promotion>> {
  return apiSend("/api/platform/promotions", "POST", input);
}

export function updatePromotion(id: string, input: UpdatePromotionInput): Promise<ActionResult<Promotion>> {
  return apiSend(`/api/platform/promotions/${id}`, "PATCH", input);
}

export function expirePromotion(id: string): Promise<ActionResult<Promotion>> {
  return apiSend(`/api/platform/promotions/${id}/expire`, "POST");
}

export function fetchPromotionUsages(id: string): Promise<ActionResult<CursorPage<PromotionUsage>>> {
  return apiGet(`/api/platform/promotions/${id}/usages`);
}
