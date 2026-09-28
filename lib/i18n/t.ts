/**
 * i18n — single source of truth for every user-facing string.
 *
 * - `ar.json` holds ALL Arabic copy. Nothing user-facing is hardcoded in
 *   components, pages, libs or server actions.
 * - `t("key")` is isomorphic: usable from server components, client
 *   components, plain libs and server actions.
 * - Keys are dot paths and are type-checked (`pnpm typecheck` fails on a typo
 *   or a missing key). `pnpm i18n:check` additionally fails on hardcoded
 *   Arabic that escaped to source files.
 * - Values may contain `{placeholder}` slots, filled by the second argument:
 *   `t("bookings.cancelConfirm.description", { name: booking.code })`.
 *
 * To add a locale later: drop `<locale>.json` next to `ar.json`, add the
 * locale to `LOCALES` below, and pick the dictionary per request.
 */
import ar from "./ar.json";

export const locale = "ar";

/** Raw dictionary — use for dynamic lookups (error codes, grid columns, enums). */
export const dictionary = ar;

export type Messages = typeof ar;

export type MessageParams = Record<string, string | number | boolean | null | undefined>;

/** Union of every valid dot path in the dictionary. */
export type MessageKey = Leaves<Messages>;

type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`;
}[keyof T & string];

function resolveMessage(key: string): string {
  let node: unknown = dictionary;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return key;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : key;
}

/** Translate `key`, filling any `{placeholder}` slots from `params`. */
export function t(key: MessageKey, params?: MessageParams): string {
  const template = resolveMessage(key);
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined || value === null) return "";
    return value === true ? "✓" : value === false ? "✗" : String(value);
  });
}

/** Typed lookup for dictionaries keyed by a runtime value (error codes, enums). */
export function tv<K extends keyof Messages, V extends keyof Messages[K]>(group: K, key: V): string {
  const value = (dictionary[group] as Record<string, unknown>)[key as string];
  return typeof value === "string" ? value : String(key);
}
