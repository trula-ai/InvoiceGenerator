"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { businesses, sessions, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { isTurnstileEnabled, verifyTurnstileToken } from "@/lib/auth/turnstile";
import { consumePasswordResetToken, createPasswordResetToken } from "@/lib/data/password-reset";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from "@/lib/validation/auth";
import type { ActionResult } from "@/lib/validation/common";

import { failure, validationFailure } from "./utils";

/** Creates a business and its first user, then signs them in. */
export async function registerAction(input: RegisterInput): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const values = parsed.data;

  try {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, values.email)).limit(1);
    if (existing) return { ok: false, error: "An account with this email already exists. Sign in instead." };

    const passwordHash = await hashPassword(values.password);
    const userId = await db.transaction(async (tx) => {
      const [business] = await tx.insert(businesses).values({ name: values.businessName }).returning({ id: businesses.id });
      const [user] = await tx
        .insert(users)
        .values({ businessId: business.id, name: values.name, email: values.email, passwordHash })
        .returning({ id: users.id });
      return user.id;
    });

    await createSession(userId);
  } catch (error) {
    return failure(error, "Could not create your account.");
  }

  redirect("/dashboard/settings?welcome=1");
}

export async function loginAction(input: LoginInput, next?: string): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const values = parsed.data;

  // Bot check first, before any database work or password hashing.
  if (isTurnstileEnabled()) {
    const h = await headers();
    const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const check = await verifyTurnstileToken(values.turnstileToken, ip);
    if (!check.ok) {
      const expired = check.errors.includes("timeout-or-duplicate");
      return {
        ok: false,
        error: expired ? "The verification expired. Please complete it again." : "Please complete the human verification to sign in.",
        fieldErrors: { turnstileToken: check.errors },
      };
    }
  }

  try {
    const [user] = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, values.email))
      .limit(1);

    const valid = user ? await verifyPassword(values.password, user.passwordHash) : false;
    if (!user || !valid) return { ok: false, error: "Incorrect email or password." };

    await createSession(user.id);
  } catch (error) {
    return failure(error, "Could not sign you in.");
  }

  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  redirect(target);
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/** Minimum wall-clock time for a reset request, so timing does not reveal whether an account exists. */
const RESET_REQUEST_MIN_MS = 500;

/**
 * Emails a password reset link when an account with that email exists. Always
 * resolves with `ok: true` (after a padded minimum duration) so the response
 * never reveals whether the address is registered. Delivery failures are
 * logged server-side and deliberately not surfaced to the caller.
 */
export async function requestPasswordResetAction(input: ForgotPasswordInput): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const started = Date.now();

  try {
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);

    if (user) {
      const token = await createPasswordResetToken(user.id);
      await sendPasswordResetEmail({ to: user.email, name: user.name, token });
    }
  } catch (error) {
    console.error("[auth] Password reset request failed:", error);
  }

  const remaining = RESET_REQUEST_MIN_MS - (Date.now() - started);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));

  return { ok: true, data: undefined };
}

const INVALID_RESET_LINK = "This reset link is invalid, has expired or has already been used. Request a new one.";

/**
 * Redeems a reset token: sets the new password, signs the user out everywhere
 * (every existing session is deleted), then starts a fresh session and sends
 * them to the dashboard. An unusable token comes back as a `token` field error
 * so the form can show the "request a new link" state.
 */
export async function resetPasswordAction(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const values = parsed.data;

  try {
    const userId = await consumePasswordResetToken(values.token);
    if (!userId) return { ok: false, error: INVALID_RESET_LINK, fieldErrors: { token: [INVALID_RESET_LINK] } };

    const passwordHash = await hashPassword(values.password);
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
      await tx.delete(sessions).where(eq(sessions.userId, userId));
    });

    await createSession(userId);
  } catch (error) {
    return failure(error, "Could not reset your password.");
  }

  redirect("/dashboard");
}
