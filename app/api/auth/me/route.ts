import { NextResponse } from "next/server";
import { fetchDashboardSession } from "@/lib/dashboard-session";
import { toArabicError } from "@/lib/errors";

/** Session admission and permissions use the same live boundary as the proxy. */
export async function GET() {
  const result = await fetchDashboardSession();
  if (!result.ok) {
    const status = result.status === 0 ? (result.code === "UPSTREAM_TIMEOUT" ? 504 : 503) : result.status;
    return NextResponse.json(
      { statusCode: status, code: result.code, message: toArabicError(result.code, status, result.rawMessage) },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json({ statusCode: 200, data: result.data }, { headers: { "Cache-Control": "no-store" } });
}
