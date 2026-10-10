import {
  boolean,
  char,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { businesses } from "./businesses";
import { clients, clientTypeEnum } from "./clients";
import { items } from "./items";

/**
 * One table holds every document kind because quotes, invoices and credit
 * notes share the same shape (client, lines, tax, totals) and the same
 * renderer, form and email pipeline. `documentKind` tells them apart and every
 * list, report and reminder query filters on it.
 *
 *   invoice:     draft -> pending -> partially_paid -> paid
 *                            \-> overdue (pending/partially_paid past due date)
 *                any (unpaid) -> cancelled
 *   quote:       draft -> pending (open) -> accepted | declined | expired -> converted
 *                `dueDate` is the validity date.
 *   credit_note: draft -> pending (issued) -> cancelled
 *                Issuing applies the total to `sourceDocumentId`'s balance.
 *
 * `overdue` is persisted (not just derived) so it can be filtered and counted in
 * SQL. `lib/data/invoices.ts#syncOverdueStatuses` promotes past-due invoices
 * and `applyPaymentTotals` recomputes after each payment or credit.
 */
export const documentKindEnum = pgEnum("document_kind", ["invoice", "quote", "credit_note"]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "pending",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
  "accepted",
  "declined",
  "expired",
  "converted",
]);

export const discountTypeEnum = pgEnum("discount_type", ["none", "percent", "fixed"]);
export const exchangeRateSourceEnum = pgEnum("exchange_rate_source", ["api", "manual", "base"]);

/** Money columns: PostgreSQL numeric, never float. Drizzle returns them as strings. */
const money = () => numeric({ precision: 14, scale: 2 });

export const invoices = pgTable(
  "invoices",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    clientId: uuid()
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),

    /** Generated: <prefix>/<financial year>/<sequence>, e.g. INV/2026-27/0001. */
    invoiceNumber: varchar({ length: 40 }).notNull(),
    /** Unguessable token for the public (no-login) invoice view and PDF link. */
    publicToken: varchar({ length: 64 }).notNull(),
    /** Indian financial year label the number was issued in, e.g. "2026-27". */
    financialYear: char({ length: 7 }).notNull(),
    documentKind: documentKindEnum().notNull().default("invoice"),
    invoiceType: clientTypeEnum().notNull(),
    status: invoiceStatusEnum().notNull().default("draft"),

    // --- Links between documents ---------------------------------------------
    /** Quote this invoice was converted from, or invoice this credit note is issued against. */
    sourceDocumentId: uuid().references((): AnyPgColumn => invoices.id, { onDelete: "set null" }),
    /** For quotes: the invoice created by "Convert to invoice". */
    convertedToId: uuid().references((): AnyPgColumn => invoices.id, { onDelete: "set null" }),

    issueDate: date().notNull(),
    dueDate: date().notNull(),

    // --- References -----------------------------------------------------------
    /** Client's purchase order number, printed on the invoice. */
    poNumber: varchar({ length: 60 }),
    /** Free-text reference (contract, project, delivery challan, ...). */
    reference: varchar({ length: 120 }),
    /** Delivery address snapshot (multi-line); null when same as billing. */
    shipToAddress: text(),

    // --- Currency -----------------------------------------------------------
    /** Invoice currency (ISO 4217). All money columns below are in this currency unless suffixed Inr. */
    currency: char({ length: 3 }).notNull(),
    /** Units of INR per 1 unit of `currency`, frozen at creation/issue. 1 for INR. */
    exchangeRate: numeric({ precision: 18, scale: 8 }).notNull(),
    exchangeRateSource: exchangeRateSourceEnum().notNull(),

    // --- GST / tax context ---------------------------------------------------
    /** Snapshot of the business GST setting at issue time. */
    gstApplied: boolean().notNull().default(false),
    /** Snapshots so historical invoices do not change if settings change. */
    businessGstin: varchar({ length: 15 }),
    clientGstin: varchar({ length: 15 }),
    placeOfSupply: varchar({ length: 100 }),
    placeOfSupplyCode: char({ length: 2 }),
    /** True when business state != place of supply (IGST); false for CGST+SGST. */
    isInterState: boolean().notNull().default(false),

    // --- Amounts (invoice currency) -----------------------------------------
    subtotal: money().notNull(),
    discountType: discountTypeEnum().notNull().default("none"),
    /** Percentage (0-100) when discountType = percent, absolute amount when fixed. */
    discountValue: money().notNull().default("0"),
    discountAmount: money().notNull().default("0"),
    taxableAmount: money().notNull(),
    cgstAmount: money().notNull().default("0"),
    sgstAmount: money().notNull().default("0"),
    igstAmount: money().notNull().default("0"),
    /** Total tax (sum of the above, or a plain tax when GST is disabled). */
    taxAmount: money().notNull().default("0"),
    /** Signed adjustment that rounds the total to a whole unit; 0 when rounding is off. */
    roundOffAmount: money().notNull().default("0"),
    total: money().notNull(),
    amountPaid: money().notNull().default("0"),
    /** Sum of issued credit notes applied against this invoice. */
    creditAmount: money().notNull().default("0"),
    /** total - amountPaid - creditAmount, never below zero. */
    balanceDue: money().notNull(),

    // --- INR equivalents (frozen at creation) -------------------------------
    totalInr: money().notNull(),

    notes: text(),
    terms: text(),

    sentAt: timestamp({ withTimezone: true }),
    paidAt: timestamp({ withTimezone: true }),
    /** When the most recent payment reminder or statement email went out. */
    lastReminderAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invoices_number_unique").on(t.businessId, t.invoiceNumber),
    uniqueIndex("invoices_public_token_unique").on(t.publicToken),
    index("invoices_business_status_idx").on(t.businessId, t.status),
    index("invoices_business_kind_idx").on(t.businessId, t.documentKind),
    index("invoices_source_idx").on(t.sourceDocumentId),
    index("invoices_business_issue_date_idx").on(t.businessId, t.issueDate),
    index("invoices_client_idx").on(t.clientId),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    sortOrder: integer().notNull().default(0),
    /** Catalog item this line was picked from, if any. Kept nullable so history survives catalog deletes. */
    itemId: uuid().references(() => items.id, { onDelete: "set null" }),
    description: text().notNull(),
    /** HSN (goods) or SAC (services) code; required for GST B2B invoices. */
    hsnSac: varchar({ length: 10 }),
    quantity: numeric({ precision: 12, scale: 3 }).notNull(),
    unit: varchar({ length: 20 }),
    unitPrice: money().notNull(),
    /** Tax percentage applied to this line (e.g. 18.00). */
    taxRate: numeric({ precision: 5, scale: 2 }).notNull().default("0"),
    /** quantity * unitPrice, before discount and tax. */
    lineSubtotal: money().notNull(),
    /** Share of the invoice-level discount allocated to this line. */
    discountAmount: money().notNull().default("0"),
    taxableAmount: money().notNull(),
    taxAmount: money().notNull().default("0"),
    lineTotal: money().notNull(),
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId)],
);

export const counterKindEnum = pgEnum("counter_kind", ["invoice", "receipt", "quote", "credit_note"]);

/**
 * Per-business, per-kind, per-financial-year sequence backing invoice and
 * receipt numbers. `lib/document-number.ts` increments it with a single atomic
 * INSERT ... ON CONFLICT DO UPDATE ... RETURNING, which is safe under
 * concurrency and can never hand out the same number twice.
 */
export const documentCounters = pgTable(
  "document_counters",
  {
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: counterKindEnum().notNull(),
    financialYear: char({ length: 7 }).notNull(),
    lastNumber: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.kind, t.financialYear] })],
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number];
export type DocumentKind = (typeof documentKindEnum.enumValues)[number];
export type DiscountType = (typeof discountTypeEnum.enumValues)[number];
