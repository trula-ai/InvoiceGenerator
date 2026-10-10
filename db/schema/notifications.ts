import { char, date, index, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { businesses } from "./businesses";
import { invoices } from "./invoices";

/**
 * In-app notifications about the payment lifecycle of invoices.
 *
 * Rows are written by the data layer when something happens (an invoice is
 * issued or paid, a payment is recorded, a reminder is emailed) and by the
 * daily check that flags invoices that are due soon, due today or overdue.
 * `dedupeKey` keeps the daily check idempotent: re-running it never creates
 * a second "due today" row for the same invoice and day.
 */
export const notificationKindEnum = pgEnum("notification_kind", [
  "invoice_issued",
  "invoice_sent",
  "payment_received",
  "invoice_paid",
  "invoice_due_soon",
  "invoice_due_today",
  "invoice_overdue",
  "invoice_cancelled",
  "reminder_sent",
  "reminder_failed",
  "statement_sent",
  "quote_accepted",
  "quote_declined",
  "quote_converted",
  "credit_note_issued",
]);

export const notificationSeverityEnum = pgEnum("notification_severity", ["info", "success", "warning", "urgent"]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: notificationKindEnum().notNull(),
    severity: notificationSeverityEnum().notNull().default("info"),
    title: varchar({ length: 200 }).notNull(),
    body: text().notNull(),

    /** Related invoice; kept nullable so the history survives invoice deletion. */
    invoiceId: uuid().references(() => invoices.id, { onDelete: "set null" }),
    invoiceNumber: varchar({ length: 40 }),
    clientName: varchar({ length: 200 }),
    /** Amount the notification is about (payment amount, balance due, ...). */
    amount: numeric({ precision: 14, scale: 2 }),
    currency: char({ length: 3 }),
    dueDate: date(),
    /** Where clicking the notification should go. */
    href: varchar({ length: 300 }),
    /** Optional idempotency key, unique per business. */
    dedupeKey: varchar({ length: 120 }),

    readAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_business_created_idx").on(t.businessId, t.createdAt),
    uniqueIndex("notifications_dedupe_unique").on(t.businessId, t.dedupeKey),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationKind = (typeof notificationKindEnum.enumValues)[number];
export type NotificationSeverity = (typeof notificationSeverityEnum.enumValues)[number];
