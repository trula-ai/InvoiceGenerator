import { char, index, numeric, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { businesses } from "./businesses";
import { invoices } from "./invoices";

export const paymentOrderStatusEnum = pgEnum("payment_order_status", ["created", "paid", "failed"]);

/**
 * One row per online checkout attempt. A Razorpay order is created for the
 * invoice's balance when the client presses "Pay now"; the checkout success
 * callback and the webhook both look the order up by `providerOrderId` to
 * record the payment exactly once.
 */
export const paymentOrders = pgTable(
  "payment_orders",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    provider: varchar({ length: 20 }).notNull().default("razorpay"),
    providerOrderId: varchar({ length: 80 }).notNull(),
    /** Amount the order was created for, in the invoice currency. */
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    currency: char({ length: 3 }).notNull(),
    status: paymentOrderStatusEnum().notNull().default("created"),
    providerPaymentId: varchar({ length: 80 }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("payment_orders_provider_order_unique").on(t.provider, t.providerOrderId), index("payment_orders_invoice_idx").on(t.invoiceId)],
);

export type PaymentOrder = typeof paymentOrders.$inferSelect;
