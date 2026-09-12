import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, clearSessionCookies } from "@/lib/auth";

function busApiUrl(): string {
  return (process.env.BUS_API_URL ?? "").replace(/\/$/, "");
}

/** POST /api/auth/logout — best-effort backend revocation, then clear cookies. */
export async function POST() {
  const base = busApiUrl();
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  if (base && access) {
    try {
      await fetch(`${base}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access}` },
        cache: "no-store",
      });
    } catch {
      // Best effort: local cookies are cleared regardless.
    }
  }
  await clearSessionCookies();
  return NextResponse.json({ statusCode: 200, data: null });
}
