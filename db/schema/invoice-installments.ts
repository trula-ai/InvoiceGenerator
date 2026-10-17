import { date, index, integer, numeric, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { businesses } from "./businesses";
import { invoices } from "./invoices";

/**
 * Installment plan ("Recurring" in the app): one invoice total split into
 * dated parts, EMI style. Rows exist only for invoices that have a plan.
 *
 * Money received against the invoice is not tied to a particular row.
 * Instead `syncInstallmentAllocation` (lib/data/installment-sync.ts) spreads
 * the invoice's paid + credited total over the installments in sequence
 * order every time the invoice totals change, so `paidAmount` is always a
 * pure function of the invoice's payments. The invoice's `dueDate` is kept
 * equal to the first unpaid installment's date, which lets reminders,
 * overdue promotion and the dashboard work unchanged.
 */
export const invoiceInstallments = pgTable(
  "invoice_installments",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    /** 1-based position in the plan. */
    sequence: integer().notNull(),
    dueDate: date().notNull(),
    /** Invoice currency. */
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    /** Portion of `amount` covered by payments or credit notes so far. */
    paidAmount: numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    /** Set when `paidAmount` first reaches `amount`; cleared if a payment is deleted. */
    paidAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invoice_installments_sequence_unique").on(t.invoiceId, t.sequence),
    index("invoice_installments_business_due_idx").on(t.businessId, t.dueDate),
  ],
);

export type InvoiceInstallment = typeof invoiceInstallments.$inferSelect;
export type NewInvoiceInstallment = typeof invoiceInstallments.$inferInsert;
