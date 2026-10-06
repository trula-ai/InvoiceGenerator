import { date, index, numeric, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { businesses } from "./businesses";
import { invoices } from "./invoices";

export const paymentMethodEnum = pgEnum("payment_method", [
  "bank_transfer",
  "upi",
  "card",
  "cash",
  "cheque",
  "other",
]);

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
    /** Sequential receipt number, e.g. RCPT/2026-27/0001. */
    receiptNumber: varchar({ length: 40 }).notNull(),
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    amountInr: numeric({ precision: 14, scale: 2 }).notNull(),
    paymentDate: date().notNull(),
    method: paymentMethodEnum().notNull().default("bank_transfer"),
    /** Transaction id, cheque number, UTR, etc. */
    reference: varchar({ length: 120 }),
    notes: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payments_business_date_idx").on(t.businessId, t.paymentDate),
    index("payments_invoice_idx").on(t.invoiceId),
  ],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number];
