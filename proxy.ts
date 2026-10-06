import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth gate. Only checks that a session cookie exists so that
 * unauthenticated visitors are redirected before any rendering happens.
 * The real check (session lookup in the database) is done by `requireUser()`
 * in layouts, pages and actions.
 */
const SESSION_COOKIE = "session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (pathname.startsWith("/dashboard") && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  if ((pathname === "/login" || pathname === "/register") && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};
