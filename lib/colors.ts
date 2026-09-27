/** Bus color presets for the add/edit dialog: Arabic name + preview swatch. */
export type BusColor = { name: string; hex: string };

export const BUS_COLORS: BusColor[] = [
  { name: "أبيض", hex: "#ffffff" },
  { name: "أسود", hex: "#111827" },
  { name: "فضي", hex: "#c0c4cc" },
  { name: "رمادي", hex: "#6b7280" },
  { name: "أزرق", hex: "#2563eb" },
  { name: "أزرق سماوي", hex: "#059ff8" },
  { name: "أزرق كحلي", hex: "#00134c" },
  { name: "أحمر", hex: "#dc2626" },
  { name: "نبيتي", hex: "#7f1d1d" },
  { name: "أخضر", hex: "#16a34a" },
  { name: "أخضر غامق", hex: "#14532d" },
  { name: "أصفر", hex: "#facc15" },
  { name: "برتقالي", hex: "#f97316" },
  { name: "بيج", hex: "#e7d8c0" },
  { name: "بني", hex: "#78502e" },
  { name: "بنفسجي", hex: "#7c3aed" },
];

/** Swatch hex for a stored color name; null when the name isn't a preset. */
export function busColorHex(name: string | null | undefined): string | null {
  if (!name) return null;
  return BUS_COLORS.find((color) => color.name === name)?.hex ?? null;
}
