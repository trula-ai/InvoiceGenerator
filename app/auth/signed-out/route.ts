import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth/session";

/**
 * GET /auth/signed-out?next=...
 *
 * Clears a session cookie that no longer maps to a usable session (expired,
 * signed out from another device, or the account was deactivated) and shows
 * the login page. Server Components cannot delete cookies, so `requireUser`
 * redirects here instead of straight to /login; otherwise the edge proxy,
 * which only checks that the cookie exists, would bounce the request back to
 * the dashboard forever.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await destroySession();
  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  const login = new URL("/login", url.origin);
  if (next && next.startsWith("/") && !next.startsWith("//")) login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
