import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { businesses } from "./businesses";
import { invoices } from "./invoices";

export const emailStatusEnum = pgEnum("email_status", ["sent", "failed"]);

/** Audit trail of every invoice email attempt. */
export const emailLogs = pgTable(
  "email_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    toEmail: varchar({ length: 320 }).notNull(),
    subject: varchar({ length: 300 }).notNull(),
    status: emailStatusEnum().notNull(),
    /** Which provider handled it (e.g. "resend", "console"). */
    provider: varchar({ length: 40 }).notNull(),
    providerMessageId: varchar({ length: 200 }),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_logs_invoice_idx").on(t.invoiceId)],
);

export type EmailLog = typeof emailLogs.$inferSelect;
