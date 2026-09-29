"use client";

import { t } from "@/lib/i18n/t";

/**
 * Driver avatar: the uploaded picture, or a fallback built from the first two
 * letters of the FULL name. Rendering the fallback deterministically (rather
 * than a generic icon) keeps the roster scannable when nobody uploaded a photo.
 */
export function DriverAvatar({
  name,
  picture,
  size = "md",
}: {
  name: string | null | undefined;
  picture?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const initials = fallbackInitials(name);
  const dimension = size === "lg" ? "size-16 text-xl" : size === "sm" ? "size-8 text-xs" : "size-10 text-sm";

  if (picture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={picture}
        alt={name ?? t("drivers.avatar.alt")}
        className={`${dimension} shrink-0 rounded-full border border-[#d8e4ec] object-cover`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${dimension} flex shrink-0 items-center justify-center rounded-full bg-[#d6eeff] font-bold text-[#059ff8]`}
    >
      {initials ?? t("drivers.avatar.fallback")}
    </span>
  );
}

/** First two letters of the full name, or null when there is no name at all. */
function fallbackInitials(name: string | null | undefined): string | null {
  const letters = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (letters.length === 0) return null;
  const first = letters[0]?.[0] ?? "";
  const second = letters.length > 1 ? (letters[1]?.[0] ?? "") : "";
  return `${first}${second}`.toLocaleUpperCase("ar-EG") || null;
}
