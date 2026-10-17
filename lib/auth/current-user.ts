import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { businesses, users, type Business, type User } from "@/db/schema";
import { hasPermission, permissionDeniedMessage, permissionsForRoles, type Permission } from "@/lib/auth/permissions";
import { getSessionUserId } from "@/lib/auth/session";
import { db } from "@/lib/db";

export interface CurrentUser {
  user: Pick<User, "id" | "name" | "email" | "businessId" | "roles">;
  business: Business;
  /** Every permission the user's roles grant, for conditional UI. */
  permissions: Permission[];
}

/** Where `requireUser` sends a request whose cookie no longer maps to a usable session. */
export const SIGNED_OUT_PATH = "/auth/signed-out";

/** Where `requirePermission` sends a signed-in user who may not open a page. */
export const ACCESS_DENIED_PATH = "/dashboard/access-denied";

/**
 * Resolves the signed-in user and their business for the current request.
 * Memoised per request with React `cache`, so layouts, pages and actions can
 * all call it without repeating the query. Deactivated users resolve to null
 * exactly like a missing session.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const [row] = await db
    .select({
      user: { id: users.id, name: users.name, email: users.email, businessId: users.businessId, roles: users.roles, disabledAt: users.disabledAt },
      business: businesses,
    })
    .from(users)
    .innerJoin(businesses, eq(businesses.id, users.businessId))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row || row.user.disabledAt) return null;
  const user = { id: row.user.id, name: row.user.name, email: row.user.email, businessId: row.user.businessId, roles: row.user.roles };
  return { user, business: row.business, permissions: permissionsForRoles(user.roles) };
});

/**
 * Like `getCurrentUser` but redirects when unauthenticated. Every data-access
 * function and Server Action that touches tenant data must take the
 * `businessId` from this, never from the request.
 *
 * A request that carries a session cookie but no usable session (expired,
 * signed out elsewhere, user deactivated) is sent through `/auth/signed-out`,
 * which clears the cookie before showing the login page. Redirecting straight
 * to `/login` would bounce back to the dashboard, because the edge proxy only
 * checks that the cookie exists.
 */
export async function requireUser(): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) redirect(SIGNED_OUT_PATH);
  return current;
}

/** True when the signed-in user's roles grant `permission`. */
export function can(current: Pick<CurrentUser, "user">, permission: Permission): boolean {
  return hasPermission(current.user.roles, permission);
}

/**
 * For pages and layouts: requires a signed-in user who holds `permission`,
 * otherwise redirects to the access-denied page.
 */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const current = await requireUser();
  if (!can(current, permission)) redirect(`${ACCESS_DENIED_PATH}?need=${encodeURIComponent(permission)}`);
  return current;
}

export type Authorization = { ok: true; current: CurrentUser } | { ok: false; error: string };

/**
 * For Server Actions: requires a signed-in user who holds `permission`.
 * Returns a failed `ActionResult` shape instead of redirecting, so the form
 * that called the action can show the message. Unauthenticated callers are
 * still redirected to sign in.
 */
export async function authorize(permission: Permission): Promise<Authorization> {
  const current = await requireUser();
  if (!can(current, permission)) return { ok: false, error: permissionDeniedMessage(permission) };
  return { ok: true, current };
}
