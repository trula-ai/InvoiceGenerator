import { boolean, char, date, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { businesses } from "./businesses";
import { clients } from "./clients";

export const recurringFrequencyEnum = pgEnum("recurring_frequency", ["weekly", "fortnightly", "monthly", "quarterly", "half_yearly", "yearly"]);
export const recurringStatusEnum = pgEnum("recurring_status", ["active", "paused", "ended"]);

/** One invoice line stored on a recurring template. */
export interface RecurringTemplateItem {
  itemId?: string;
  description: string;
  hsnSac?: string;
  quantity: string;
  unit?: string;
  unitPrice: string;
  taxRate: string;
}

/**
 * Everything needed to build the next invoice, copied from the invoice the
 * profile was created from. Dates and the invoice number are computed at run
 * time; the exchange rate here is only a fallback when a live rate is unavailable.
 */
export interface RecurringTemplate {
  invoiceType: "b2b" | "b2c";
  currency: string;
  exchangeRate: string;
  placeOfSupplyCode?: string;
  /** GST classification copied from the source invoice; re-validated on every run. */
  supplyType?: "domestic_intra_state" | "domestic_inter_state" | "export_lut" | "export_with_igst" | "international_taxable" | "exempt";
  discountType: "none" | "percent" | "fixed";
  discountValue: string;
  poNumber?: string;
  reference?: string;
  shipToAddress?: string;
  notes?: string;
  terms?: string;
  items: RecurringTemplateItem[];
}

/**
 * A schedule that turns a template into a real invoice on each run date.
 * `nextRunDate` is advanced inside the same transaction that creates the
 * invoice, under a row lock, so a run can never produce the same invoice twice.
 */
export const recurringProfiles = pgTable(
  "recurring_profiles",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    clientId: uuid()
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),

    /** Label shown in lists, e.g. "Monthly retainer". */
    name: varchar({ length: 120 }).notNull(),
    frequency: recurringFrequencyEnum().notNull().default("monthly"),
    status: recurringStatusEnum().notNull().default("active"),
    /** First invoice date; later dates keep this day of the month where possible. */
    startDate: date().notNull(),
    /** Date of the next invoice to generate. */
    nextRunDate: date().notNull(),
    /** No invoices are generated after this date. */
    endDate: date(),
    /** Stop after this many invoices. */
    maxOccurrences: integer(),
    occurrences: integer().notNull().default(0),
    /** Email each generated invoice to the client immediately. */
    autoSend: boolean().notNull().default(true),

    template: jsonb().$type<RecurringTemplate>().notNull(),
    /** Invoice this profile was created from, for reference. */
    sourceInvoiceNumber: varchar({ length: 40 }),
    currency: char({ length: 3 }).notNull(),

    lastRunAt: timestamp({ withTimezone: true }),
    lastInvoiceId: uuid(),
    /** Message from the most recent failed run; cleared on the next success. */
    lastError: text(),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("recurring_profiles_business_idx").on(t.businessId, t.status), index("recurring_profiles_next_run_idx").on(t.status, t.nextRunDate)],
);

export type RecurringProfile = typeof recurringProfiles.$inferSelect;
export type RecurringFrequency = (typeof recurringFrequencyEnum.enumValues)[number];
export type RecurringStatus = (typeof recurringStatusEnum.enumValues)[number];
