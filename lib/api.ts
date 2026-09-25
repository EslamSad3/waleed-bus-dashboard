import { cookies } from "next/headers";
import { ACCESS_COOKIE, clearSessionCookies, refreshSession } from "./auth";
import { busApiUrl } from "./config";
import type { BackendFailure } from "./errors";

export type BusResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: string; details?: BackendFailure["details"] };

type BusFetchOptions = {
  method?: string;
  body?: unknown;
  /** Raw multipart body (forwarded with its content type, never JSON-encoded). */
  rawBody?: { bytes: ArrayBuffer; contentType: string };
  /** Attach the fleet-scope hint (persisted zustand filter → cookie → header). */
  fleetId?: string | null;
  /** Retry once via refresh on 401 (default true; false for the refresh call itself). */
  retryAuth?: boolean;
};

/**
 * Server-side backend fetch (BFF). Attaches the JWT, unwraps the
 * `{statusCode, data}` envelope exactly once, preserves cursor pages untouched.
 */
export async function busFetch<T>(path: string, opts: BusFetchOptions = {}): Promise<BusResult<T>> {
  const { method = "GET", body, rawBody, fleetId, retryAuth = true } = opts;
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;

  const headers: Record<string, string> = {};
  if (access) headers.Authorization = `Bearer ${access}`;
  if (fleetId) headers["x-fleet-id"] = fleetId;
  if (rawBody) headers["Content-Type"] = rawBody.contentType;
  else if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${busApiUrl()}${path}`, {
      method,
      headers,
      body:
        rawBody !== undefined
          ? rawBody.bytes
          : body === undefined
            ? undefined
            : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, code: "NETWORK_ERROR" };
  }

  if (res.status === 401 && retryAuth) {
    const refreshed = await refreshSession();
    if (!refreshed) {
      await clearSessionCookies();
      return { ok: false, status: 401, code: "AUTHENTICATION_FAILED" };
    }
    return busFetch<T>(path, { ...opts, retryAuth: false });
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const failure = (payload ?? {}) as Partial<BackendFailure>;
    return {
      ok: false,
      status: res.status,
      code: failure.code ?? (res.status === 429 ? "RATE_LIMITED_429" : "UNKNOWN"),
      details: failure.details,
    };
  }

  const envelope = (payload ?? {}) as { data?: T };
  return { ok: true, status: res.status, data: envelope.data as T };
}
