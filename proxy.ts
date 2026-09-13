import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REMEMBER_COOKIE,
  deleteSessionCookies,
  fetchIdentity,
  rotateRefreshToken,
  writeSessionCookies,
} from "@/lib/auth";

/**
 * Session edge guard (Principle I, first layer). It restores an expired access
 * cookie from the rotating refresh token before the protected request reaches
 * the shell. The shell layout still performs the authoritative role check.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  const remembered = req.cookies.get(REMEMBER_COOKIE)?.value === "1";

  if (pathname === "/login") {
    if (accessToken) {
      const identity = await fetchIdentity(accessToken);
      if (identity?.appRole === "super_admin") {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    if (refreshToken) {
      const rotated = await rotateRefreshToken(refreshToken);
      if (rotated) {
        const response = NextResponse.redirect(new URL("/", req.url));
        writeSessionCookies(response.cookies, rotated.accessToken, rotated.refreshToken, remembered);
        return response;
      }
    }

    if (accessToken || refreshToken) {
      const response = NextResponse.next();
      deleteSessionCookies(response.cookies);
      return response;
    }
    return NextResponse.next();
  }

  if (!accessToken) {
    if (refreshToken) {
      const rotated = await rotateRefreshToken(refreshToken);
      if (rotated) {
        const response = NextResponse.redirect(req.nextUrl);
        writeSessionCookies(response.cookies, rotated.accessToken, rotated.refreshToken, remembered);
        return response;
      }
    }

    const response = NextResponse.redirect(new URL("/login", req.url));
    deleteSessionCookies(response.cookies);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
