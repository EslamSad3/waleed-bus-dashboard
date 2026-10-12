import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { busFetch } from "@/lib/api";
import { ACCESS_COOKIE, identityFromValidatedToken } from "@/lib/auth";
import { platformPermissions } from "@/lib/access";
import { isDashboardRole } from "@/lib/auth";
import { toArabicError } from "@/lib/errors";

/** Session validation remains live; identity for the store comes from JWT claims. */
export async function GET() {
  const result = await busFetch<{ id: string; platformPermissions?: unknown }>("/me");
  if (!result.ok) {
    const code = result.status === 401 ? "AUTHENTICATION_FAILED" : result.code;
    return NextResponse.json(
      { statusCode: result.status, code, message: toArabicError(code, result.status) },
      { status: result.status === 0 ? 503 : result.status },
    );
  }
  // Read after busFetch: it may have refreshed and replaced the access cookie.
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  const identity = accessToken ? identityFromValidatedToken(accessToken) : null;
  if (!identity || identity.id !== result.data.id || !isDashboardRole(identity.appRole)) {
    return NextResponse.json({ statusCode: 401, code: "AUTHENTICATION_FAILED", message: toArabicError("AUTHENTICATION_FAILED") }, { status: 401 });
  }
  return NextResponse.json({ statusCode: 200, data: { ...identity, permissions: platformPermissions(result.data.platformPermissions) } });
}
