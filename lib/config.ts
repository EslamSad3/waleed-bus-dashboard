/**
 * Shared dashboard configuration helpers.
 */

/**
 * Resolves the base URL for the backend bus_api service.
 * Throws early if BUS_API_URL environment variable is unset.
 */
export function busApiUrl(): string {
  const base = process.env.BUS_API_URL;
  if (!base) throw new Error("BUS_API_URL is not configured");
  return base.replace(/\/$/, "");
}

/**
 * Resolves the canonical external origin of the dashboard (e.g. http://localhost:3000
 * or https://dashboard.waleedbus.com).
 */
export function dashboardOrigin(): string | null {
  const origin = process.env.DASHBOARD_ORIGIN;
  return origin ? origin.replace(/\/$/, "") : null;
}

/**
 * Validates that an incoming mutation request originates from the trusted canonical origin,
 * preventing cross-site state-changing POST/PATCH/DELETE requests.
 *
 * When DASHBOARD_ORIGIN is configured, it strictly validates new URL(origin).origin against it.
 * In environments where DASHBOARD_ORIGIN is not set, it falls back to comparing against
 * Host / X-Forwarded-Host.
 */
export function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // Same-origin navigations or non-browser agents have no Origin

  let requestOrigin: string;
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    return false;
  }

  const configured = dashboardOrigin();
  if (configured) {
    return requestOrigin === configured;
  }

  // Fallback when DASHBOARD_ORIGIN is unset (e.g. local dev):
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || req.headers.get("host");
  if (!requestHost) return false;

  try {
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}
