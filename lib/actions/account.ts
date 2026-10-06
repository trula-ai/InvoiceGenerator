"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, eq, ne } from "drizzle-orm";

import { sessions, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, hashSessionToken } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { changePasswordSchema, profileSchema, type ChangePasswordInput, type ProfileInput } from "@/lib/validation/account";
import type { ActionResult } from "@/lib/validation/common";

import { failure, validationFailure } from "./utils";

/** Updates the signed-in user's name and email. The email must not belong to another account. */
export async function updateProfileAction(input: ProfileInput): Promise<ActionResult> {
  const { user } = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const values = parsed.data;

  try {
    if (values.email !== user.email) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, values.email), ne(users.id, user.id)))
        .limit(1);
      if (existing) {
        return { ok: false, error: "That email is already in use.", fieldErrors: { email: ["That email is already in use."] } };
      }
    }

    await db.update(users).set({ name: values.name, email: values.email, updatedAt: new Date() }).where(eq(users.id, user.id));
  } catch (error) {
    return failure(error, "Could not update your profile.");
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true, data: undefined };
}

const WRONG_CURRENT_PASSWORD = "Current password is incorrect.";

/**
 * Changes the signed-in user's password after verifying the current one, then
 * signs out every other device by deleting all of the user's sessions except
 * the one making this request.
 */
export async function changePasswordAction(input: ChangePasswordInput): Promise<ActionResult> {
  const { user } = await requireUser();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const values = parsed.data;

  try {
    const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
    if (!row) return { ok: false, error: "Your account could not be found." };

    const valid = await verifyPassword(values.currentPassword, row.passwordHash);
    if (!valid) return { ok: false, error: WRONG_CURRENT_PASSWORD, fieldErrors: { currentPassword: [WRONG_CURRENT_PASSWORD] } };

    const passwordHash = await hashPassword(values.newPassword);

    // Identify the current session by hashing the cookie the same way session.ts does.
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    const currentSessionId = token ? hashSessionToken(token) : null;

    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));
      await tx
        .delete(sessions)
        .where(currentSessionId ? and(eq(sessions.userId, user.id), ne(sessions.id, currentSessionId)) : eq(sessions.userId, user.id));
    });
  } catch (error) {
    return failure(error, "Could not change your password.");
  }

  return { ok: true, data: undefined };
}
