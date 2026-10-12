import { platformPermissions } from "./access";
export { can, isDashboardRole } from "./access";

import { cookies } from "next/headers";
import { busApiUrl } from "./config";

/**
 * Server-only session helpers (httpOnly cookies, Principle II).
 * Cookies: `sa_access` (short-lived JWT) + `sa_refresh` (opaque, rotating).
 * Tokens NEVER leave the server: the browser only ever sees session cookies.
 */
export const ACCESS_COOKIE = "sa_access";
export const REFRESH_COOKIE = "sa_refresh";
/** Server-only persistence marker; lets refresh rotation preserve remember-me. */
export const REMEMBER_COOKIE = "sa_remember";
/** Access JWT lifetime (~15m). */
export const ACCESS_MAX_AGE = 900;
/** Refresh persistence when "تذكرني" is checked — capped at the backend 7-day window. */
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 7;

export type SessionIdentity = {
  id: string;
  email: string | null;
  /** app_role from the access JWT after backend validation of that token/session. */
  appRole: string;
  permissions: string[];
};

const secure = process.env.NODE_ENV === "production";

type CookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge?: number;
};

type CookieWriter = {
  set(name: string, value: string, options: CookieOptions): unknown;
  delete(name: string): unknown;
};

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure,
  sameSite: "lax",
  path: "/",
};

/** Works with both Next's cookie store and NextResponse.cookies. */
export function writeSessionCookies(
  target: CookieWriter,
  accessToken: string,
  refreshToken: string,
  rememberMe: boolean,
): void {
  target.set(ACCESS_COOKIE, accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_MAX_AGE,
  });
  target.set(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions,
    ...(rememberMe ? { maxAge: REFRESH_MAX_AGE } : {}),
  });

  if (rememberMe) {
    target.set(REMEMBER_COOKIE, "1", {
      ...baseCookieOptions,
      maxAge: REFRESH_MAX_AGE,
    });
  } else {
    target.delete(REMEMBER_COOKIE);
  }
}

export function deleteSessionCookies(target: CookieWriter): void {
  target.delete(ACCESS_COOKIE);
  target.delete(REFRESH_COOKIE);
  target.delete(REMEMBER_COOKIE);
}

export async function setSessionCookies(
  accessToken: string,
  refreshToken: string,
  rememberMe: boolean,
): Promise<void> {
  const store = await cookies();
  writeSessionCookies(store, accessToken, refreshToken, rememberMe);
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  deleteSessionCookies(store);
}

export async function rotateRefreshToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch(`${busApiUrl()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const body = (await res.json()) as {
      data?: { accessToken?: string; refreshToken?: string };
    };
    if (!body?.data?.accessToken || !body.data.refreshToken) return null;
    return {
      accessToken: body.data.accessToken,
      refreshToken: body.data.refreshToken,
    };
  } catch {
    return null;
  }
}

/**
 * Decode identity for routing only. The caller MUST first validate this exact
 * token with the API; decoding alone does not authenticate its signature.
 */
export function identityFromValidatedToken(accessToken: string): SessionIdentity | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3 || parts.some((part) => !part)) return null;
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (
      header.alg !== "HS256" ||
      typeof claims.sub !== "string" || !claims.sub ||
      typeof claims.app_role !== "string" || !claims.app_role ||
      (claims.email !== null && typeof claims.email !== "string") ||
      typeof claims.exp !== "number" || claims.exp <= Date.now() / 1000
    ) return null;
    return { id: claims.sub, email: claims.email, appRole: claims.app_role, permissions: [] };
  } catch {
    return null;
  }
}

/** Validate the live token/session; routing identity comes from its JWT claims. */
export async function fetchIdentity(accessToken: string): Promise<SessionIdentity | null> {
  const identity = identityFromValidatedToken(accessToken);
  if (!identity) return null;
  try {
    const res = await fetch(`${busApiUrl()}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { id?: string; platformPermissions?: unknown } };
    if (body?.data?.id !== identity.id) return null;
    return { ...identity, permissions: platformPermissions(body.data.platformPermissions) };
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
        const rotated = await rotateRefreshToken(refreshToken);
        if (!rotated) {
          await clearSessionCookies();
          return false;
        }
        const persistent = store.get(REMEMBER_COOKIE)?.value === "1";
        await setSessionCookies(rotated.accessToken, rotated.refreshToken, persistent);
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
