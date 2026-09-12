import { cookies } from "next/headers";

/**
 * Server-only session helpers (httpOnly cookies, Principle II).
 * Cookies: `sa_access` (short-lived JWT) + `sa_refresh` (opaque, rotating).
 * Tokens NEVER leave the server: the browser only ever sees session cookies.
 */
export const ACCESS_COOKIE = "sa_access";
export const REFRESH_COOKIE = "sa_refresh";
/** Access JWT lifetime (~15m). */
export const ACCESS_MAX_AGE = 900;
/** Refresh persistence when "تذكرني" is checked — capped at the backend 7-day window. */
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 7;

export type SessionIdentity = {
  id: string;
  email: string | null;
  /** CurrentUserDto.appRole — the ONLY role source the dashboard trusts. */
  appRole: string;
};

function busApiUrl(): string {
  const base = process.env.BUS_API_URL;
  if (!base) throw new Error("BUS_API_URL is not configured");
  return base.replace(/\/$/, "");
}

const secure = process.env.NODE_ENV === "production";

export async function setSessionCookies(
  accessToken: string,
  refreshToken: string,
  rememberMe: boolean,
): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  });
  store.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    ...(rememberMe ? { maxAge: REFRESH_MAX_AGE } : {}),
  });
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

/** Direct backend call — no proxy recursion (used by route handlers only). */
export async function fetchIdentity(accessToken: string): Promise<SessionIdentity | null> {
  try {
    const res = await fetch(`${busApiUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: SessionIdentity };
    if (!body?.data || typeof body.data.appRole !== "string") return null;
    return body.data;
  } catch {
    return null;
  }
}

export async function readSession(): Promise<SessionIdentity | null> {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  if (!access) return null;
  return fetchIdentity(access);
}

/**
 * Single-flight refresh: concurrent 401s share one rotation request so the
 * single-use refresh token is never spent twice (which would log the user out).
 */
let refreshPromise: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const store = await cookies();
        const refreshToken = store.get(REFRESH_COOKIE)?.value;
        if (!refreshToken) {
          await clearSessionCookies();
          return false;
        }
        const res = await fetch(`${busApiUrl()}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
          cache: "no-store",
        });
        if (!res.ok) {
          await clearSessionCookies();
          return false;
        }
        const body = (await res.json()) as {
          data?: { accessToken?: string; refreshToken?: string };
        };
        if (!body?.data?.accessToken || !body?.data?.refreshToken) {
          await clearSessionCookies();
          return false;
        }
        // Preserve persistence choice: keep Max-Age iff the incoming cookie had one.
        const incoming = store.get(REFRESH_COOKIE);
        const persistent = Boolean(
          incoming && (incoming as { maxAge?: number }).maxAge,
        );
        await setSessionCookies(body.data.accessToken, body.data.refreshToken, persistent);
        return true;
      } catch {
        await clearSessionCookies().catch(() => undefined);
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}
