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
  /** Attach the owner-scope hint (persisted zustand filter → cookie → header). */
  ownerId?: string | null;
  /** Retry once via refresh on 401 (default true; false for the refresh call itself). */
  retryAuth?: boolean;
  /** Abort budget for the backend call (default 15s; Vercel Hobby kills at ~10-60s). */
  timeoutMs?: number;
};

/**
 * Server-side backend fetch (BFF). Attaches the JWT, unwraps the
 * `{statusCode, data}` envelope exactly once, preserves cursor pages untouched.
 */
export async function busFetch<T>(path: string, opts: BusFetchOptions = {}): Promise<BusResult<T>> {
  const { method = "GET", body, rawBody, ownerId, retryAuth = true, timeoutMs = 15000 } = opts;
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;

  const headers: Record<string, string> = {};
  if (access) headers.Authorization = `Bearer ${access}`;
  if (ownerId) headers["x-owner-id"] = ownerId;
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
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // Timeouts (AbortError) get their own code so the UI can say "took too
    // long, retry" instead of the generic failure message.
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return { ok: false, status: 0, code: "UPSTREAM_TIMEOUT" };
    }
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, status: 0, code: "UPSTREAM_TIMEOUT" };
    }
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
    // Platform-level failures (Vercel timeout/edge 503s) return HTML with no
    // `{code}` body — surface them as UPSTREAM_UNAVAILABLE instead of the
    // opaque UNKNOWN so the UI can explain what happened.
    const code =
      failure.code ??
      (res.status === 429
        ? "RATE_LIMITED_429"
        : res.status >= 500 && payload === null
          ? "UPSTREAM_UNAVAILABLE"
          : "UNKNOWN");
    return {
      ok: false,
      status: res.status,
      code,
      details: failure.details,
    };
  }

  const envelope = (payload ?? {}) as { data?: T };
  return { ok: true, status: res.status, data: envelope.data as T };
}
