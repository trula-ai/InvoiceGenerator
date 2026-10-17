import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { businesses } from "./businesses";

/**
 * Roles a user can hold inside their business. A user may hold several (the
 * same person can be both sales manager and finance manager); `admin` implies
 * every permission. What each role may do is defined in
 * `lib/auth/permissions.ts`, never checked against role names directly.
 */
export const userRoleEnum = pgEnum("user_role", ["admin", "sales_manager", "finance_manager", "salesperson"]);

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
    /** Roles held in the business; empty means the user can sign in but do nothing. */
    roles: userRoleEnum()
      .array()
      .notNull()
      .default(sql`'{}'::user_role[]`),
    /** Set when an admin deactivates the user: sign-in is refused and sessions are deleted. */
    disabledAt: timestamp({ withTimezone: true }),
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

/**
 * Invitations to join a business. The emailed link carries a random token;
 * only its SHA-256 hash is stored (`tokenHash`). Accepting creates the user
 * with the invited roles. Resending issues a new token; revoking sets
 * `revokedAt`. At most one open invitation per business and email.
 */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    /** Lower-cased. */
    email: varchar({ length: 320 }).notNull(),
    /** Optional name the inviter typed; pre-fills the accept form. */
    name: varchar({ length: 120 }),
    roles: userRoleEnum()
      .array()
      .notNull()
      .default(sql`'{}'::user_role[]`),
    /** SHA-256 hex digest of the raw invitation token. */
    tokenHash: varchar({ length: 64 }).notNull(),
    invitedByUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
    /** User created when the invitation was accepted. */
    acceptedUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invitations_token_hash_unique").on(t.tokenHash),
    index("invitations_business_idx").on(t.businessId, t.email),
  ],
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
