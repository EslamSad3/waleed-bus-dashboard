import type { z } from "zod";
import { t } from "@/lib/i18n/t";

export type FieldErrors = Record<string, string>;

/** Keep nested paths so repeated rows can each report their own error. */
export function schemaErrors(schema: z.ZodType, values: unknown): FieldErrors {
  const result = schema.safeParse(values, { error: (issue) => {
    if (issue.code === "too_big" && issue.origin === "string") return t("validation.maxLength", { max: String(issue.maximum) });
    return t("validation.invalid");
  } });
  if (result.success) return {};
  const fields: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    if (!fields[key]) fields[key] = /[\u0600-\u06ff]/.test(issue.message) ? issue.message : t("validation.invalid");
  }
  return fields;
}

export function requiredField(value: string, message = t("validation.required")): string | undefined {
  return value.trim() ? undefined : message;
}

/** Only accept a maps URL containing finite coordinates within geographic bounds. */
export function coordinatesFromMapLink(value: string): { latitude: number; longitude: number } | null {
  try {
    const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!(host === "maps.google.com" || /^(?:www\.)?google\.(?:com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(host) || host === "maps.app.goo.gl" || host === "goo.gl")) return null;
    const decoded = decodeURIComponent(url.href);
    const match = decoded.match(/[?&](?:q|query|ll)=([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)/)
      ?? decoded.match(/!3d([-+]?\d+(?:\.\d+)?)!4d([-+]?\d+(?:\.\d+)?)/)
      ?? decoded.match(/@([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)/);
    if (!match) return null;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    return Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180
      ? { latitude, longitude } : null;
  } catch {
    return null;
  }
}
