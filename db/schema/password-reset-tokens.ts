import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { users } from "./users";

/**
 * Single-use password reset tokens. The emailed link carries a random token;
 * only its SHA-256 hash is stored here (see `lib/data/password-reset.ts`), so a
 * database leak does not expose usable reset links. Tokens expire after 60
 * minutes and are marked `usedAt` once redeemed.
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    /** SHA-256 hex digest of the raw token. */
    id: varchar({ length: 64 }).primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("password_reset_tokens_user_idx").on(t.userId)],
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
