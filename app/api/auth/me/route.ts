import { NextResponse } from "next/server";
import { busFetch } from "@/lib/api";
import type { SessionIdentity } from "@/lib/auth";
import { toArabicError } from "@/lib/errors";

/** GET /api/auth/me — session identity for the zustand store + layout guard. */
export async function GET() {
  const result = await busFetch<SessionIdentity>("/auth/me");
  if (!result.ok) {
    const code = result.status === 401 ? "AUTHENTICATION_FAILED" : result.code;
    return NextResponse.json(
      { statusCode: result.status, code, message: toArabicError(code, result.status) },
      { status: result.status === 0 ? 503 : result.status },
    );
  }
  return NextResponse.json({ statusCode: 200, data: result.data });
}
