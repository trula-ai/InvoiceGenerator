import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq, lt } from "drizzle-orm";

import { sessions } from "@/db/schema";
import { db } from "@/lib/db";

/**
 * Cookie-backed server sessions.
 *
 * The browser holds a random 256-bit token in an httpOnly cookie. The database
 * stores only the SHA-256 of that token, so a leaked `sessions` table cannot be
 * replayed. Sessions last 30 days and are extended on use.
 */

export const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * SHA-256 hex of a raw session token, i.e. the `sessions.id` it maps to. Lets
 * other modules identify the current session row (e.g. to sign out every other
 * device) without duplicating the hashing scheme.
 */
export function hashSessionToken(token: string): string {
  return hashToken(token);
}

function expiryFromNow(): Date {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

/** Creates a session row and sets the cookie. Call from a Server Action or Route Handler. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = expiryFromNow();
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Deletes the current session row (if any) and clears the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }
  store.delete(SESSION_COOKIE);
}

/** Returns the user id for the current request's session, or null. */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.id, hashToken(token)))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
    return null;
  }
  return row.userId;
}

/** Housekeeping: remove expired sessions. Safe to call opportunistically. */
export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
