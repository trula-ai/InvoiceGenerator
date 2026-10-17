import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { businesses } from "./businesses";
import { clients } from "./clients";
import { invoices } from "./invoices";
import { users } from "./users";

/**
 * Who gets the sales credit for an invoice (the "sale").
 *
 *   pending  -> approved   (sales manager agreed with the proposed owner)
 *            -> rejected   (sales manager disagreed; the proposer may try again)
 *   approved -> approved   (reassigned by a sales manager; prior owner kept)
 *   rejected -> pending    (re-proposed)
 *
 * This is deliberately separate from payment verification: approving who is
 * credited says nothing about whether money arrived, and verifying a payment
 * says nothing about who sold it. The credited person is internal and is
 * never printed on an invoice or receipt. Every change is also written to
 * `attribution_events` so the history survives later edits.
 */
export const attributionStatusEnum = pgEnum("attribution_status", ["pending", "approved", "rejected"]);

export const attributionActionEnum = pgEnum("attribution_action", ["proposed", "reproposed", "approved", "rejected", "reassigned"]);

export const saleAttributions = pgTable(
  "sale_attributions",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    /** The sale: one attribution per invoice. */
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    clientId: uuid()
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    /** Member currently credited with the sale (proposed or approved). */
    creditedUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** Who proposed the current credited member. */
    assignedByUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    assignedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Optional note from the proposer, e.g. "Closed jointly, credit to Priya". */
    reason: text(),
    status: attributionStatusEnum().notNull().default("pending"),
    /** Sales manager who approved, rejected or reassigned. */
    reviewedByUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp({ withTimezone: true }),
    /** Manager's note; required when rejecting or reassigning. */
    reviewNote: text(),
    /** Owner before the most recent reassignment, for the audit trail. */
    previousCreditedUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sale_attributions_invoice_unique").on(t.invoiceId),
    index("sale_attributions_business_status_idx").on(t.businessId, t.status),
    index("sale_attributions_credited_idx").on(t.businessId, t.creditedUserId),
  ],
);

/** Append-only history of every action taken on an attribution. */
export const attributionEvents = pgTable(
  "attribution_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    attributionId: uuid()
      .notNull()
      .references(() => saleAttributions.id, { onDelete: "cascade" }),
    action: attributionActionEnum().notNull(),
    actorUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    /** Credited member before the action (null for the first proposal). */
    fromUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    /** Credited member after the action. */
    toUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attribution_events_attribution_idx").on(t.attributionId, t.createdAt)],
);

export type SaleAttribution = typeof saleAttributions.$inferSelect;
export type AttributionEvent = typeof attributionEvents.$inferSelect;
export type AttributionStatus = (typeof attributionStatusEnum.enumValues)[number];
export type AttributionAction = (typeof attributionActionEnum.enumValues)[number];
