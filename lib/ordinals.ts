/**
 * Arabic ordinal labels for rank/sort-order columns (issue: "الترتيب" shows
 * "الأول في القائمه", "الثاني في القائمه" … instead of numbers).
 */
const ORDINALS = [
  "الأول في القائمه",
  "الثاني في القائمه",
  "الثالث في القائمه",
  "الرابع في القائمه",
  "الخامس في القائمه",
  "السادس في القائمه",
  "السابع في القائمه",
  "الثامن في القائمه",
  "التاسع في القائمه",
  "العاشر في القائمه",
] as const;

export function rankOrdinalAr(rank: number | null | undefined): string {
  if (rank == null || !Number.isFinite(rank)) return "—";
  const n = Math.trunc(rank);
  if (n >= 1 && n <= ORDINALS.length) return ORDINALS[n - 1];
  return `رقم ${n} في القائمه`;
}
