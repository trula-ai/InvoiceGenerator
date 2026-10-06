import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { businesses, users, type Business, type User } from "@/db/schema";
import { getSessionUserId } from "@/lib/auth/session";
import { db } from "@/lib/db";

export interface CurrentUser {
  user: Pick<User, "id" | "name" | "email" | "businessId">;
  business: Business;
}

/**
 * Resolves the signed-in user and their business for the current request.
 * Memoised per request with React `cache`, so layouts, pages and actions can
 * all call it without repeating the query.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const [row] = await db
    .select({
      user: { id: users.id, name: users.name, email: users.email, businessId: users.businessId },
      business: businesses,
    })
    .from(users)
    .innerJoin(businesses, eq(businesses.id, users.businessId))
    .where(eq(users.id, userId))
    .limit(1);

  return row ?? null;
});

/**
 * Like `getCurrentUser` but redirects to the login page when unauthenticated.
 * Every data-access function and Server Action that touches tenant data must
 * take the `businessId` from this, never from the request.
 */
export async function requireUser(): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  return current;
}
