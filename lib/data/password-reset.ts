import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";

import { passwordResetTokens } from "@/db/schema";
import { db } from "@/lib/db";

/** How long an emailed reset link stays valid. */
export const PASSWORD_RESET_TTL_MINUTES = 60;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a fresh reset token for a user, invalidating any outstanding ones.
 * Returns the raw token to embed in the email link; only its hash is stored.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await tx.insert(passwordResetTokens).values({ id: hashToken(token), userId, expiresAt });
  });

  return token;
}

/**
 * Redeems a raw token. Succeeds only when the token exists, has not expired and
 * has not been used before; the update is atomic so a link cannot be redeemed
 * twice concurrently. Returns the owning user id, or null when invalid.
 */
export async function consumePasswordResetToken(rawToken: string): Promise<string | null> {
  const token = rawToken.trim();
  if (!token) return null;

  const now = new Date();
  const [row] = await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(passwordResetTokens.id, hashToken(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ),
    )
    .returning({ userId: passwordResetTokens.userId });

  return row?.userId ?? null;
}

/** Housekeeping: remove expired tokens. Safe to call opportunistically. */
export async function purgeExpiredPasswordResetTokens(): Promise<void> {
  await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, new Date()));
}
