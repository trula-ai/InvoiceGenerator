import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm";

import { clients, invoices, payments, type InvoiceStatus } from "@/db/schema";
import { db } from "@/lib/db";

/**
 * Complete transaction history: invoices issued and payments received, merged
 * into one chronological feed.
 */

export type HistoryEntryKind = "invoice" | "payment";

export interface HistoryEntry {
  kind: HistoryEntryKind;
  id: string;
  /** ISO date the event is dated (issue date or payment date). */
  date: string;
  createdAt: Date;
  reference: string;
  relatedReference?: string;
  clientId: string;
  clientName: string;
  currency: string;
  amount: string;
  amountInr: string;
  status?: InvoiceStatus;
  method?: string;
  href: string;
}

export interface HistoryFilters {
  q?: string;
  clientId?: string;
  from?: string;
  to?: string;
  kind?: HistoryEntryKind | "all";
}

export async function getTransactionHistory(businessId: string, filters: HistoryFilters = {}): Promise<HistoryEntry[]> {
  const entries: HistoryEntry[] = [];

  if (filters.kind !== "payment") {
    const conditions = [eq(invoices.businessId, businessId)];
    if (filters.clientId) conditions.push(eq(invoices.clientId, filters.clientId));
    if (filters.from) conditions.push(gte(invoices.issueDate, filters.from));
    if (filters.to) conditions.push(lte(invoices.issueDate, filters.to));
    if (filters.q) {
      const pattern = `%${filters.q.trim()}%`;
      conditions.push(or(ilike(invoices.invoiceNumber, pattern), ilike(clients.name, pattern))!);
    }
    const rows = await db
      .select({
        id: invoices.id,
        date: invoices.issueDate,
        createdAt: invoices.createdAt,
        reference: invoices.invoiceNumber,
        clientId: clients.id,
        clientName: clients.name,
        currency: invoices.currency,
        amount: invoices.total,
        amountInr: invoices.totalInr,
        status: invoices.status,
      })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(and(...conditions))
      .orderBy(desc(invoices.issueDate))
      .limit(500);
    for (const r of rows) {
      entries.push({ kind: "invoice", ...r, href: `/dashboard/invoices/${r.id}` });
    }
  }

  if (filters.kind !== "invoice") {
    const conditions = [eq(payments.businessId, businessId)];
    if (filters.clientId) conditions.push(eq(invoices.clientId, filters.clientId));
    if (filters.from) conditions.push(gte(payments.paymentDate, filters.from));
    if (filters.to) conditions.push(lte(payments.paymentDate, filters.to));
    if (filters.q) {
      const pattern = `%${filters.q.trim()}%`;
      conditions.push(
        or(ilike(payments.receiptNumber, pattern), ilike(invoices.invoiceNumber, pattern), ilike(clients.name, pattern))!,
      );
    }
    const rows = await db
      .select({
        id: payments.id,
        date: payments.paymentDate,
        createdAt: payments.createdAt,
        reference: payments.receiptNumber,
        relatedReference: invoices.invoiceNumber,
        invoiceId: invoices.id,
        clientId: clients.id,
        clientName: clients.name,
        currency: invoices.currency,
        amount: payments.amount,
        amountInr: payments.amountInr,
        method: payments.method,
      })
      .from(payments)
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(and(...conditions))
      .orderBy(desc(payments.paymentDate))
      .limit(500);
    for (const r of rows) {
      const { invoiceId, ...rest } = r;
      entries.push({ kind: "payment", ...rest, href: `/dashboard/invoices/${invoiceId}` });
    }
  }

  entries.sort((a, b) => (a.date === b.date ? b.createdAt.getTime() - a.createdAt.getTime() : a.date < b.date ? 1 : -1));
  return entries;
}
