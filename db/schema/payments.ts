import { customType, date, index, integer, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { businesses } from "./businesses";
import { invoices } from "./invoices";
import { users } from "./users";

export const paymentMethodEnum = pgEnum("payment_method", [
  "bank_transfer",
  "upi",
  "card",
  "cash",
  "cheque",
  "other",
]);

/**
 * Verification lifecycle of a payment record.
 *
 *   pending  -> verified   (finance confirmed the money arrived)
 *            -> rejected   (finance could not find it; reason recorded)
 *   verified -> reversed   (refund, bounce or chargeback; reason recorded)
 *
 * Only `verified` payments count toward an invoice's paid amount and balance
 * (see `applyPaymentTotals`). Rejected and reversed rows are kept for the
 * audit trail and never deleted.
 */
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "verified", "rejected", "reversed"]);

/**
 * A payment received against an invoice. Amounts are in the invoice currency;
 * `amountInr` is frozen using the invoice's stored exchange rate so reports
 * never shift when live rates change.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    /**
     * Sequential receipt number, e.g. RCPT/2026-27/0001, allocated when the
     * payment is verified (gateway payments are verified on arrival). Null
     * while pending or when rejected, so the statutory sequence has no gaps
     * for money that never arrived. Kept after a reversal for the audit trail.
     */
    receiptNumber: varchar({ length: 40 }),
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    amountInr: numeric({ precision: 14, scale: 2 }).notNull(),
    /** Date the funds were actually received, not the date the row was entered. */
    paymentDate: date().notNull(),
    method: paymentMethodEnum().notNull().default("bank_transfer"),
    /** Transaction id, cheque number, UTR, etc. Searched for duplicate warnings. */
    reference: varchar({ length: 120 }),
    /** Bank account, UPI id or gateway account the money landed in. */
    receivingAccount: varchar({ length: 120 }),
    notes: text(),
    /** "manual" for payments typed in by the business, or the gateway name ("razorpay"). */
    provider: varchar({ length: 20 }).notNull().default("manual"),
    /** Gateway payment id; unique so a checkout callback and a webhook can never double-record. */
    providerPaymentId: varchar({ length: 80 }),
    providerOrderId: varchar({ length: 80 }),

    // --- Verification -------------------------------------------------------
    status: paymentStatusEnum().notNull().default("pending"),
    /** User who entered the payment; null for gateway payments and rows older than verification. */
    recordedByUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    /** Finance user who verified or rejected it; null when verified automatically (gateway) or backfilled. */
    reviewedByUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    /** When the payment became verified or rejected. */
    reviewedAt: timestamp({ withTimezone: true }),
    /** Required when rejected. */
    rejectionReason: text(),
    reversedByUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    reversedAt: timestamp({ withTimezone: true }),
    /** Required when reversed (refund, bounced transfer, chargeback, entered in error). */
    reversalReason: text(),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payments_business_date_idx").on(t.businessId, t.paymentDate),
    index("payments_invoice_idx").on(t.invoiceId),
    index("payments_business_status_idx").on(t.businessId, t.status),
    uniqueIndex("payments_provider_payment_unique").on(t.provider, t.providerPaymentId),
  ],
);

/** PostgreSQL bytea, read and written as a Node Buffer. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Proof attached to a payment: a screenshot, bank statement extract or
 * gateway confirmation. Stored in the database so access always goes through
 * an authenticated route (`/api/payments/:id/evidence/:evidenceId`); there
 * are no public file URLs. Files are limited to a few megabytes.
 */
export const paymentEvidence = pgTable(
  "payment_evidence",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    paymentId: uuid()
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    fileName: varchar({ length: 200 }).notNull(),
    contentType: varchar({ length: 100 }).notNull(),
    sizeBytes: integer().notNull(),
    data: bytea().notNull(),
    uploadedByUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payment_evidence_payment_idx").on(t.paymentId)],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number];
export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];
export type PaymentEvidence = typeof paymentEvidence.$inferSelect;
