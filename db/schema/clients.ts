import { boolean, char, index, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { businesses } from "./businesses";

/**
 * B2B clients are registered businesses (optionally with a GSTIN); B2C clients
 * are individual consumers. The type is the default for new invoices and can
 * be overridden per invoice.
 */
export const clientTypeEnum = pgEnum("client_type", ["b2b", "b2c"]);

export const clients = pgTable(
  "clients",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),

    type: clientTypeEnum().notNull().default("b2b"),
    name: varchar({ length: 200 }).notNull(),
    /** Contact person for B2B clients. */
    contactName: varchar({ length: 120 }),
    email: varchar({ length: 320 }),
    phone: varchar({ length: 40 }),
    gstin: varchar({ length: 15 }),

    addressLine1: varchar({ length: 200 }),
    addressLine2: varchar({ length: 200 }),
    city: varchar({ length: 100 }),
    state: varchar({ length: 100 }),
    /** Two-digit GST state code when the client is in India. */
    stateCode: char({ length: 2 }),
    postalCode: varchar({ length: 20 }),
    country: varchar({ length: 100 }).notNull().default("India"),

    /** Delivery address when goods go somewhere other than the billing address (multi-line). */
    shippingAddress: text(),

    /** Preferred invoicing currency for this client (ISO 4217). */
    currency: char({ length: 3 }).notNull().default("INR"),
    notes: text(),
    /** Opt-out for scheduled payment reminder emails; manual sends are always allowed. */
    autoReminders: boolean().notNull().default(true),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Soft delete: archived clients are hidden from pickers but keep history. */
    archivedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("clients_business_idx").on(t.businessId), index("clients_name_idx").on(t.businessId, t.name)],
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
