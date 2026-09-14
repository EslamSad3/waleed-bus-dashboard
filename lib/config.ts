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
 * Validates that an incoming mutation request originates from the same host,
 * preventing cross-site state-changing POST/PATCH/DELETE requests.
 */
export function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // Same-origin navigations or curl have no Origin

  // `req.nextUrl` reflects the container's internal address when Next runs
  // behind Docker or a reverse proxy. Compare the browser Origin with the
  // externally visible request host instead, preferring the proxy-standard
  // forwarded header and falling back to Host for direct deployments.
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || req.headers.get("host");
  if (!requestHost) return false;

  try {
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}
