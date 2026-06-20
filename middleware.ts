import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = ["/chats", "/calls", "/settings", "/profile", "/admin", "/groups", "/join"];
const accessCookieName = process.env.AUTH_COOKIE_NAME ?? "purechat.session";
const refreshCookieName = `${accessCookieName}.refresh`;
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && unsafeMethods.has(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");

    let originHost: string | undefined;
    try {
      originHost = origin ? new URL(origin).host : undefined;
    } catch {
      originHost = undefined;
    }

    if (!originHost || !host || originHost !== host) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
  }

  const isProtected = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasAccessCookie = Boolean(request.cookies.get(accessCookieName)?.value);
  const hasRefreshCookie = Boolean(request.cookies.get(refreshCookieName)?.value);

  if (!hasAccessCookie && !hasRefreshCookie) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/chats/:path*", "/calls/:path*", "/settings/:path*", "/profile/:path*", "/admin/:path*", "/groups/:path*", "/join/:path*"]
};
