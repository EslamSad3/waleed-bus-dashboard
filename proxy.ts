import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth";

/**
 * Optimistic shell guard (Principle I, first layer). Next.js 16 `proxy.ts`
 * convention (renamed from `middleware.ts`; behavior identical).
 * Cookie presence only — the JWT is backend-signed so this layer CANNOT verify
 * the role; `(shell)/layout.tsx` performs the authoritative
 * `appRole === 'super_admin'` check via GET /auth/me.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(ACCESS_COOKIE)?.value);

  if (pathname === "/login") {
    if (hasSession) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (!hasSession) return NextResponse.redirect(new URL("/login", req.url));

  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
