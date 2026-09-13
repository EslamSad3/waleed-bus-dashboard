import { conflictMessage, type ConflictKey } from "@/lib/errors";

/**
 * Client-callable BFF action helpers (P0 login precedent: client fetch to
 * same-origin `/api/*`; cookies httpOnly auto-attach, Origin checked
 * server-side). The proxy already returns Arabic `message`s; these helpers add
 * typing + per-screen bare-409 `CONFLICT` context (research R3).
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string; fields?: Record<string, string> };

type ApiEnvelope<T> = {
  statusCode: number;
  code?: string;
  message?: string;
  data?: T;
  details?: { fields?: Record<string, string | string[]> };
};

function normalizeFields(raw: Record<string, string | string[]> | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v.join("، ") : v]),
  );
}

async function parse<T>(res: Response, conflictKey?: ConflictKey): Promise<ActionResult<T>> {
  const payload = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (res.ok && payload && "data" in payload && payload.data !== undefined) {
    return { ok: true, data: payload.data as T };
  }
  // DELETE-style 200s may carry data: null — treat ok-status as success.
  if (res.ok) return { ok: true, data: null as T };
  const code = payload?.code;
  const message =
    code === "CONFLICT" && conflictKey
      ? conflictMessage(conflictKey)
      : (payload?.message ?? "حصلت مشكلة، حاول تاني");
  return { ok: false, message, code, fields: normalizeFields(payload?.details?.fields) };
}

export async function apiGet<T>(path: string, fleetId?: string | null): Promise<ActionResult<T>> {
  try {
    const res = await fetch(path, {
      headers: fleetId ? { "x-fleet-id": fleetId } : {},
      cache: "no-store",
    });
    return parse<T>(res);
  } catch {
    return { ok: false, message: "مشكلة في الاتصال بالسيرفر", code: "NETWORK_ERROR" };
  }
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
  conflictKey?: ConflictKey,
  fleetId?: string | null,
): Promise<ActionResult<T>> {
  try {
    const res = await fetch(path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(fleetId ? { "x-fleet-id": fleetId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return parse<T>(res, conflictKey);
  } catch {
    return { ok: false, message: "مشكلة في الاتصال بالسيرفر", code: "NETWORK_ERROR" };
  }
}

export type CursorPage<T> = { items: T[]; nextCursor: string | null };
