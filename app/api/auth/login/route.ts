import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/schemas/auth";
import { clearSessionCookies, fetchIdentity, setSessionCookies } from "@/lib/auth";
import { busApiUrl, originAllowed } from "@/lib/config";
import { toArabicError } from "@/lib/errors";

/**
 * POST /api/auth/login — validates (trust boundary), forwards WITHOUT loginType
 * (backend platform login resolves by email), stores tokens in httpOnly cookies,
 * and admits ONLY super_admin (anyone else gets the generic error).
 */
export async function POST(req: Request) {
  if (!originAllowed(req)) {
    return NextResponse.json(
      { statusCode: 403, code: "FORBIDDEN", message: "ممنوع" },
      { status: 403 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { statusCode: 400, code: "VALIDATION_FAILED", message: toArabicError("VALIDATION_FAILED") },
      { status: 400 },
    );
  }

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "form";
      (fields[key] ??= []).push(issue.message);
    }
    return NextResponse.json(
      {
        statusCode: 400,
        code: "VALIDATION_FAILED",
        message: toArabicError("VALIDATION_FAILED"),
        details: { fields },
      },
      { status: 400 },
    );
  }

  const { email, password, rememberMe } = parsed.data;

  let res: Response;
  try {
    res = await fetch(`${busApiUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { statusCode: 503, code: "NETWORK_ERROR", message: toArabicError("NETWORK_ERROR") },
      { status: 503 },
    );
  }

  const payload = (await res.json().catch(() => null)) as {
    code?: string;
    data?: { accessToken?: string; refreshToken?: string };
  } | null;

  if (!res.ok) {
    // Never distinguish unknown user / wrong password / inactive: generic copy.
    const code = res.status === 429 ? "RATE_LIMITED_429" : "AUTHENTICATION_FAILED";
    return NextResponse.json(
      { statusCode: res.status, code, message: toArabicError(code, res.status) },
      { status: res.status },
    );
  }

  const accessToken = payload?.data?.accessToken;
  const refreshToken = payload?.data?.refreshToken;
  if (!accessToken || !refreshToken) {
    return NextResponse.json(
      { statusCode: 502, code: "UNKNOWN", message: toArabicError("UNKNOWN") },
      { status: 502 },
    );
  }

  const identity = await fetchIdentity(accessToken);
  if (!identity || identity.appRole !== "super_admin") {
    await clearSessionCookies();
    return NextResponse.json(
      {
        statusCode: 403,
        code: "AUTHENTICATION_FAILED",
        message: toArabicError("AUTHENTICATION_FAILED"),
      },
      { status: 403 },
    );
  }

  await setSessionCookies(accessToken, refreshToken, rememberMe);
  return NextResponse.json({ statusCode: 201, data: identity }, { status: 201 });
}
