import { t } from "@/lib/i18n/t";

/**
 * Arabic ordinal labels for rank/sort-order columns (copy lives in
 * lib/i18n/ar.json under `ordinals.*`).
 */


const ORDINALS = [
  t("ordinals.1"),
  t("ordinals.2"),
  t("ordinals.3"),
  t("ordinals.4"),
  t("ordinals.5"),
  t("ordinals.6"),
  t("ordinals.7"),
  t("ordinals.8"),
  t("ordinals.9"),
  t("ordinals.10"),
] as const;

export function rankOrdinalAr(rank: number | null | undefined): string {
  if (rank == null || !Number.isFinite(rank)) return "—";
  const n = Math.trunc(rank);
  if (n >= 1 && n <= ORDINALS.length) return ORDINALS[n - 1];
  return t("ordinals.fallback", { n: n });
}
