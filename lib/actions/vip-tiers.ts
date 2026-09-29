import { apiGet, apiSend, type ActionResult } from "@/lib/actions/http";
import { notifyResult } from "@/lib/actions/toast";
import { t } from "@/lib/i18n/t";

/**
 * VIP tiers are a platform catalog, not a company: `/vip-tiers` stays top-level
 * resource even after spec 014 moved the *assignment* route to
 * the owner company does not own tiers. Split into its own module so the
 * fleet-owner screen does not carry an unrelated catalog module.
 */
export type VipTier = {
  id: string;
  name: string;
  rank: number;
  isActive: boolean;
};

export const fetchVipTiers = (includeInactive = false) =>
  apiGet<VipTier[]>(`/api/vip-tiers${includeInactive ? "?includeInactive=true" : ""}`);
export const createVipTier = (input: { name: string; rank: number; isActive?: boolean }) =>
  notifyResult(t("vipTiers.toast.created"), apiSend<VipTier>("/api/vip-tiers", "POST", input));
export const updateVipTier = (id: string, input: { name?: string; rank?: number; isActive?: boolean }) =>
  notifyResult(
    input.isActive === undefined ? t("vipTiers.toast.saved") : input.isActive ? t("vipTiers.toast.activated") : t("vipTiers.toast.deactivated"),
    apiSend<VipTier>(`/api/vip-tiers/${id}`, "PATCH", input),
  );
export const deleteVipTier = (id: string) =>
  notifyResult(t("vipTiers.toast.deleted"), apiSend<null>(`/api/vip-tiers/${id}`, "DELETE"));

export type { ActionResult };
