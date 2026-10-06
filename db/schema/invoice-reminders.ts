import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { businesses } from "./businesses";
import { invoices } from "./invoices";

/**
 * Ledger of automatic reminder emails, one row per invoice and schedule stage.
 *
 * `stageKey` encodes the stage and the occurrence (for example
 * `due_soon:2026-10-18`, `due_today:2026-10-18`, `overdue:2026-10-18:2`), so
 * the scheduler can run as often as it likes and still send each reminder
 * exactly once. Failed sends are not recorded, which makes them retry on the
 * next run.
 */
export const reminderStageEnum = pgEnum("reminder_stage", ["due_soon", "due_today", "overdue"]);

export const invoiceReminders = pgTable(
  "invoice_reminders",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    stage: reminderStageEnum().notNull(),
    stageKey: varchar({ length: 80 }).notNull(),
    toEmail: varchar({ length: 320 }).notNull(),
    sentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("invoice_reminders_stage_unique").on(t.invoiceId, t.stageKey),
    index("invoice_reminders_business_idx").on(t.businessId, t.sentAt),
  ],
);

export type InvoiceReminder = typeof invoiceReminders.$inferSelect;
export type ReminderStage = (typeof reminderStageEnum.enumValues)[number];
