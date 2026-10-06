import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  clients,
  invoices,
  notifications,
  type InvoiceStatus,
  type Notification,
  type NotificationKind,
  type NotificationSeverity,
} from "@/db/schema";
import { db, type Database } from "@/lib/db";
import { addDaysIso, todayIso } from "@/lib/fiscal-year";
import { formatCurrency, formatDate } from "@/lib/format";

/**
 * Notification feed: creation helpers used by the invoice and payment data
 * layers, the daily due-date scan, and the read model for the UI.
 *
 * This module must not import `lib/data/invoices` (which imports it), so the
 * payable status list is mirrored here.
 */

type Tx = Pick<Database, "select" | "insert" | "update" | "delete" | "execute">;

const PAYABLE: InvoiceStatus[] = ["pending", "partially_paid", "overdue"];

/** How many days before the due date a "due soon" notice is raised. */
export const DUE_SOON_DAYS = 3;

export interface NotificationInput {
  kind: NotificationKind;
  severity?: NotificationSeverity;
  title: string;
  body: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  clientName?: string | null;
  amount?: string | null;
  currency?: string | null;
  dueDate?: string | null;
  href?: string | null;
  dedupeKey?: string | null;
}

export interface InvoiceSnapshot {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string | null;
  status: InvoiceStatus;
  total: string;
  amountPaid: string;
  balanceDue: string;
  currency: string;
  issueDate: string;
  dueDate: string;
}

const SEVERITY_BY_KIND: Record<NotificationKind, NotificationSeverity> = {
  invoice_issued: "info",
  invoice_sent: "info",
  payment_received: "success",
  invoice_paid: "success",
  invoice_due_soon: "warning",
  invoice_due_today: "urgent",
  invoice_overdue: "urgent",
  invoice_cancelled: "info",
  reminder_sent: "success",
  reminder_failed: "warning",
  statement_sent: "success",
};

export function daysBetweenIso(fromIso: string, toIso: string): number {
  const from = Date.UTC(Number(fromIso.slice(0, 4)), Number(fromIso.slice(5, 7)) - 1, Number(fromIso.slice(8, 10)));
  const to = Date.UTC(Number(toIso.slice(0, 4)), Number(toIso.slice(5, 7)) - 1, Number(toIso.slice(8, 10)));
  return Math.round((to - from) / 86_400_000);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Inserts one notification. Duplicate `dedupeKey`s for the same business are silently ignored. */
export async function createNotification(businessId: string, input: NotificationInput, tx: Tx = db): Promise<void> {
  await tx
    .insert(notifications)
    .values({
      businessId,
      kind: input.kind,
      severity: input.severity ?? SEVERITY_BY_KIND[input.kind],
      title: input.title,
      body: input.body,
      invoiceId: input.invoiceId ?? null,
      invoiceNumber: input.invoiceNumber ?? null,
      clientName: input.clientName ?? null,
      amount: input.amount ?? null,
      currency: input.currency ?? null,
      dueDate: input.dueDate ?? null,
      href: input.href ?? null,
      dedupeKey: input.dedupeKey ?? null,
    })
    .onConflictDoNothing({ target: [notifications.businessId, notifications.dedupeKey] });
}

export async function loadInvoiceSnapshot(businessId: string, invoiceId: string, tx: Tx = db): Promise<InvoiceSnapshot | null> {
  const [row] = await tx
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      clientName: clients.name,
      clientEmail: clients.email,
      status: invoices.status,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      balanceDue: invoices.balanceDue,
      currency: invoices.currency,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.businessId, businessId), eq(invoices.id, invoiceId)))
    .limit(1);
  return row ?? null;
}

export type InvoiceEventKind = Exclude<NotificationKind, "invoice_due_soon" | "invoice_due_today" | "invoice_overdue" | "statement_sent">;

export interface InvoiceEventExtra {
  /** Email recipient for sent/reminder events. */
  to?: string;
  /** Payment amount for payment_received. */
  amount?: string;
  methodLabel?: string;
  reference?: string | null;
  receiptNumber?: string;
  /** Provider error for reminder_failed. */
  error?: string;
}

/** Builds the human-readable notification for an invoice lifecycle event. */
export function describeInvoiceEvent(kind: InvoiceEventKind, inv: InvoiceSnapshot, extra: InvoiceEventExtra = {}): NotificationInput {
  const money = (v: string) => formatCurrency(v, inv.currency);
  const base: NotificationInput = {
    kind,
    title: "",
    body: "",
    invoiceId: inv.id,
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.clientName,
    currency: inv.currency,
    dueDate: inv.dueDate,
    href: `/dashboard/invoices/${inv.id}`,
  };

  switch (kind) {
    case "invoice_issued":
      return {
        ...base,
        amount: inv.total,
        title: `Invoice ${inv.invoiceNumber} issued`,
        body: `${inv.clientName} has been billed ${money(inv.total)}, due by ${formatDate(inv.dueDate)}.`,
      };
    case "invoice_sent":
      return {
        ...base,
        amount: inv.balanceDue,
        title: `Invoice ${inv.invoiceNumber} emailed`,
        body: `Sent to ${extra.to ?? inv.clientEmail ?? inv.clientName}. ${money(inv.balanceDue)} is due by ${formatDate(inv.dueDate)}.`,
      };
    case "payment_received":
      return {
        ...base,
        amount: extra.amount ?? null,
        title: `Payment received for ${inv.invoiceNumber}`,
        body: `${inv.clientName} paid ${money(extra.amount ?? "0")}${extra.methodLabel ? ` via ${extra.methodLabel.toLowerCase()}` : ""}${extra.reference ? ` (ref ${extra.reference})` : ""}.${extra.receiptNumber ? ` Receipt ${extra.receiptNumber}.` : ""} Remaining balance ${money(inv.balanceDue)}.`,
      };
    case "invoice_paid":
      return {
        ...base,
        amount: inv.total,
        title: `Invoice ${inv.invoiceNumber} paid in full`,
        body: `${inv.clientName} has settled the full amount of ${money(inv.total)}.`,
      };
    case "invoice_cancelled":
      return {
        ...base,
        amount: inv.total,
        title: `Invoice ${inv.invoiceNumber} cancelled`,
        body: `The ${money(inv.total)} invoice to ${inv.clientName} was cancelled.`,
      };
    case "reminder_sent":
      return {
        ...base,
        amount: inv.balanceDue,
        title: `Payment reminder sent for ${inv.invoiceNumber}`,
        body: `${inv.clientName} was reminded at ${extra.to ?? inv.clientEmail ?? "their email"} that ${money(inv.balanceDue)} is due${inv.dueDate === todayIso() ? " today" : ` by ${formatDate(inv.dueDate)}`}.`,
        dedupeKey: `reminder_sent:${inv.id}:${todayIso()}`,
      };
    case "reminder_failed":
      return {
        ...base,
        amount: inv.balanceDue,
        title: `Reminder for ${inv.invoiceNumber} could not be sent`,
        body: `${inv.clientName} still owes ${money(inv.balanceDue)}. ${extra.error ?? "The email provider rejected the message."}`,
      };
  }
}

/** Loads the invoice and records a lifecycle notification in one call. */
export async function notifyInvoiceEvent(
  businessId: string,
  invoiceId: string,
  kind: InvoiceEventKind,
  extra: InvoiceEventExtra = {},
  tx: Tx = db,
): Promise<void> {
  const inv = await loadInvoiceSnapshot(businessId, invoiceId, tx);
  if (!inv) return;
  await createNotification(businessId, describeInvoiceEvent(kind, inv, extra), tx);
}

/**
 * Raises due-soon, due-today and overdue notices for unpaid invoices.
 * Idempotent: each notice carries a dedupe key for the invoice and day (or
 * week, for repeated overdue nags), so running it on every page load is safe.
 */
export async function syncPaymentNotifications(businessId: string, today = todayIso()): Promise<number> {
  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      clientName: clients.name,
      balanceDue: invoices.balanceDue,
      currency: invoices.currency,
      dueDate: invoices.dueDate,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.businessId, businessId), inArray(invoices.status, PAYABLE), sql`${invoices.balanceDue} > 0`));

  const soonLimit = addDaysIso(today, DUE_SOON_DAYS);
  const values: (typeof notifications.$inferInsert)[] = [];

  for (const inv of rows) {
    const money = formatCurrency(inv.balanceDue, inv.currency);
    const common = {
      businessId,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.clientName,
      amount: inv.balanceDue,
      currency: inv.currency,
      dueDate: inv.dueDate,
      href: `/dashboard/invoices/${inv.id}`,
    };

    if (inv.dueDate === today) {
      values.push({
        ...common,
        kind: "invoice_due_today",
        severity: "urgent",
        title: `Invoice ${inv.invoiceNumber} is due today`,
        body: `${inv.clientName} owes ${money}. Payment is due today, ${formatDate(today)}.`,
        dedupeKey: `due_today:${inv.id}:${today}`,
      });
    } else if (inv.dueDate > today && inv.dueDate <= soonLimit) {
      const days = daysBetweenIso(today, inv.dueDate);
      values.push({
        ...common,
        kind: "invoice_due_soon",
        severity: "warning",
        title: `Invoice ${inv.invoiceNumber} due in ${plural(days, "day")}`,
        body: `${inv.clientName} still owes ${money}, due ${formatDate(inv.dueDate)}.`,
        dedupeKey: `due_soon:${inv.id}:${inv.dueDate}`,
      });
    } else if (inv.dueDate < today) {
      const days = daysBetweenIso(inv.dueDate, today);
      values.push({
        ...common,
        kind: "invoice_overdue",
        severity: "urgent",
        title: `Invoice ${inv.invoiceNumber} is ${plural(days, "day")} overdue`,
        body: `${inv.clientName} owes ${money}. It was due on ${formatDate(inv.dueDate)}.`,
        dedupeKey: `overdue:${inv.id}:${inv.dueDate}:w${Math.floor(days / 7)}`,
      });
    }
  }

  if (!values.length) return 0;
  const inserted = await db
    .insert(notifications)
    .values(values)
    .onConflictDoNothing({ target: [notifications.businessId, notifications.dedupeKey] })
    .returning({ id: notifications.id });
  return inserted.length;
}

// --- Read model --------------------------------------------------------------

export async function listNotifications(businessId: string, limit = 200): Promise<Notification[]> {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.businessId, businessId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit);
}

export async function getUnreadNotificationCount(businessId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(notifications)
    .where(and(eq(notifications.businessId, businessId), isNull(notifications.readAt)));
  return row?.count ?? 0;
}

export async function markNotificationRead(businessId: string, id: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.businessId, businessId), eq(notifications.id, id), isNull(notifications.readAt)));
}

export async function markAllNotificationsRead(businessId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.businessId, businessId), isNull(notifications.readAt)));
}
