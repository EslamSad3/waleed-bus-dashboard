import { t } from "@/lib/i18n/t";

/** Bus color presets for the add/edit dialog: Arabic name + preview swatch. */

export type BusColor = { name: string; hex: string };

export const BUS_COLORS: BusColor[] = [
  { name: t("colors.white"), hex: "#ffffff" },
  { name: t("colors.black"), hex: "#111827" },
  { name: t("colors.silver"), hex: "#c0c4cc" },
  { name: t("colors.gray"), hex: "#6b7280" },
  { name: t("colors.blue"), hex: "#2563eb" },
  { name: t("colors.skyBlue"), hex: "#059ff8" },
  { name: t("colors.navy"), hex: "#00134c" },
  { name: t("colors.red"), hex: "#dc2626" },
  { name: t("colors.maroon"), hex: "#7f1d1d" },
  { name: t("colors.green"), hex: "#16a34a" },
  { name: t("colors.darkGreen"), hex: "#14532d" },
  { name: t("colors.yellow"), hex: "#facc15" },
  { name: t("colors.orange"), hex: "#f97316" },
  { name: t("colors.beige"), hex: "#e7d8c0" },
  { name: t("colors.brown"), hex: "#78502e" },
  { name: t("colors.purple"), hex: "#7c3aed" },
];

/** Swatch hex for a stored color name; null when the name isn't a preset. */
export function busColorHex(name: string | null | undefined): string | null {
  if (!name) return null;
  return BUS_COLORS.find((color) => color.name === name)?.hex ?? null;
}
