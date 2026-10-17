import { boolean, char, customType, date, index, integer, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { businesses } from "./businesses";
import { invoices } from "./invoices";
import { payments } from "./payments";

export const receiptDeliveryStatusEnum = pgEnum("receipt_delivery_status", ["not_sent", "sent", "failed"]);

/** PostgreSQL bytea, read and written as a Node Buffer. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const money = () => numeric({ precision: 14, scale: 2 });

/**
 * The client-facing receipt for one verified payment, frozen at the moment
 * the payment was verified. Everything the document shows (amount, total
 * paid so far, balance outstanding, due date, terms) is copied here so a
 * receipt issued in September still reads the same after October's payment.
 * The rendered PDF is stored too, so downloads and resends serve the exact
 * file the client first received. A reversed payment voids its receipt.
 */
export const receipts = pgTable(
  "receipts",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    paymentId: uuid()
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    receiptNumber: varchar({ length: 40 }).notNull(),
    issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),

    // --- Snapshot of the transaction -----------------------------------------
    currency: char({ length: 3 }).notNull(),
    /** Paid now. */
    amount: money().notNull(),
    paymentDate: date().notNull(),
    methodLabel: varchar({ length: 40 }).notNull(),
    reference: varchar({ length: 120 }),
    invoiceNumber: varchar({ length: 40 }).notNull(),
    invoiceDate: date().notNull(),
    /** Line descriptions joined, e.g. "Registration; Documentation". */
    serviceDescription: text(),
    invoiceTotal: money().notNull(),
    /** Total paid so far, including this payment. */
    cumulativePaid: money().notNull(),
    /** Balance outstanding after this payment. */
    balanceDue: money().notNull(),
    dueDate: date().notNull(),
    /** True when the balance was already past due when the receipt was issued. */
    wasOverdue: boolean().notNull().default(false),

    // --- Snapshot of the terms ----------------------------------------------
    termsText: text(),
    privacyUrl: varchar({ length: 300 }),
    termsVersion: integer().notNull().default(0),

    // --- Stored document ------------------------------------------------------
    pdf: bytea(),
    pdfGeneratedAt: timestamp({ withTimezone: true }),

    // --- Delivery ---------------------------------------------------------------
    deliveryStatus: receiptDeliveryStatusEnum().notNull().default("not_sent"),
    sentCount: integer().notNull().default(0),
    lastSentAt: timestamp({ withTimezone: true }),
    lastSentTo: varchar({ length: 320 }),
    lastError: text(),

    /** Set when the payment is reversed; the receipt stays for the record but is no longer valid. */
    voidedAt: timestamp({ withTimezone: true }),
    voidReason: text(),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("receipts_payment_unique").on(t.paymentId), index("receipts_invoice_idx").on(t.invoiceId), index("receipts_business_issued_idx").on(t.businessId, t.issuedAt)],
);

export type Receipt = typeof receipts.$inferSelect;
export type ReceiptDeliveryStatus = (typeof receiptDeliveryStatusEnum.enumValues)[number];
