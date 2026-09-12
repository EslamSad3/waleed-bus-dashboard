import { NextResponse } from "next/server";
import { toArabicError } from "@/lib/errors";

/** GET /api/health — public backend liveness passthrough (no auth attached). */
export async function GET() {
  const base = (process.env.BUS_API_URL ?? "").replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      { statusCode: 500, code: "UNKNOWN", message: toArabicError("UNKNOWN") },
      { status: 500 },
    );
  }
  try {
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    const payload = await res.json().catch(() => null);
    return NextResponse.json(payload, { status: res.status });
  } catch {
    return NextResponse.json(
      { statusCode: 503, code: "NETWORK_ERROR", message: toArabicError("NETWORK_ERROR") },
      { status: 503 },
    );
  }
}
