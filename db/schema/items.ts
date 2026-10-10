import { index, numeric, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { businesses } from "./businesses";

/**
 * Item catalog: the products and services a business sells, with their usual
 * HSN/SAC code, unit, price and tax rate. Picking an item in the invoice form
 * copies these values onto the invoice line; the line keeps its own copy so
 * later catalog edits never change issued invoices.
 */
export const items = pgTable(
  "items",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),

    name: varchar({ length: 200 }).notNull(),
    /** Longer text printed under the name on the invoice line. */
    description: text(),
    /** HSN (goods) or SAC (services) code. */
    hsnSac: varchar({ length: 10 }),
    unit: varchar({ length: 20 }),
    unitPrice: numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    /** Default tax percentage, e.g. 18.00. */
    taxRate: numeric({ precision: 5, scale: 2 }).notNull().default("0"),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Soft delete: archived items are hidden from the picker but keep history. */
    archivedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("items_business_idx").on(t.businessId), index("items_name_idx").on(t.businessId, t.name)],
);

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
