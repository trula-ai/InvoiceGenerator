import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { businesses } from "./businesses";

/**
 * Application users. A user belongs to exactly one business. Passwords are
 * stored as scrypt hashes (see `lib/auth/password.ts`), never in plain text.
 */
export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: varchar({ length: 120 }).notNull(),
    /** Stored lower-cased; uniqueness is enforced on the lower-cased value. */
    email: varchar({ length: 320 }).notNull().unique(),
    passwordHash: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_business_idx").on(t.businessId)],
);

/**
 * Server-side sessions. The cookie holds a random token; only its SHA-256 hash
 * is stored here, so a database leak does not expose usable session tokens.
 */
export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 hex digest of the session token. */
    id: varchar({ length: 64 }).primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
