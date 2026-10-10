import { boolean, char, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * A business (tenant). Every domain row carries a `businessId` and every query
 * is scoped by it, which is what isolates one business's data from another's.
 *
 * GST is configurable: when `gstEnabled` is false, invoices still support a
 * per-item tax rate, but the CGST/SGST/IGST split is not applied and GST fields
 * are not shown on documents. This keeps the design open to other tax systems.
 */
export const businesses = pgTable("businesses", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 200 }).notNull(),
  legalName: varchar({ length: 200 }),
  email: varchar({ length: 320 }),
  phone: varchar({ length: 40 }),
  website: varchar({ length: 200 }),

  addressLine1: varchar({ length: 200 }),
  addressLine2: varchar({ length: 200 }),
  city: varchar({ length: 100 }),
  /** State / province name, e.g. "Karnataka". */
  state: varchar({ length: 100 }),
  /** Two-digit GST state code (India), e.g. "29". Used for intra/inter-state decisions. */
  stateCode: char({ length: 2 }),
  postalCode: varchar({ length: 20 }),
  country: varchar({ length: 100 }).notNull().default("India"),

  gstEnabled: boolean().notNull().default(false),
  gstin: varchar({ length: 15 }),
  pan: varchar({ length: 10 }),

  /** ISO 4217 code used when creating new invoices by default. */
  defaultCurrency: char({ length: 3 }).notNull().default("INR"),
  /** Prefix for generated invoice numbers, e.g. "INV" -> INV/2026-27/0001. */
  invoicePrefix: varchar({ length: 10 }).notNull().default("INV"),
  /** Prefix for quote numbers, e.g. "QT" -> QT/2026-27/0001. */
  quotePrefix: varchar({ length: 10 }).notNull().default("QT"),
  /** Prefix for credit note numbers, e.g. "CN" -> CN/2026-27/0001. */
  creditNotePrefix: varchar({ length: 10 }).notNull().default("CN"),
  /** Default payment terms in days, used to compute due dates. */
  paymentTermsDays: integer().notNull().default(15),
  /** How long a new quote stays valid, in days. */
  quoteValidityDays: integer().notNull().default(30),
  /** Free-text shown on every invoice (bank details, UPI id, etc.). */
  bankDetails: text(),
  /** Default notes / terms copied onto new invoices. */
  invoiceNotes: text(),
  invoiceTerms: text(),
  /** Small PNG/JPEG logo as a data URL, printed on PDFs and the public invoice page. */
  logoDataUrl: text(),

  // --- Document presentation ---------------------------------------------
  /** Round the invoice total to the nearest whole currency unit (round-off line). */
  roundTotals: boolean().notNull().default(false),
  /** Signature image (PNG/JPEG data URL) printed in the authorised-signatory block. */
  signatureDataUrl: text(),
  /** Name printed under the signature, e.g. "Priya Sharma, Director". */
  signatoryName: varchar({ length: 120 }),

  // --- Automatic payment reminders ----------------------------------------
  /** Master switch for scheduled reminder emails (lib/email/due-reminders.ts). */
  remindersEnabled: boolean().notNull().default(true),
  /** Send a "due soon" reminder this many days before the due date (0 disables). */
  reminderDaysBefore: integer().notNull().default(3),
  /** Repeat an overdue reminder every N days after the due date (0 disables). */
  reminderOverdueEveryDays: integer().notNull().default(7),

  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
