import { and, asc, desc, eq, ilike, isNull, or } from "drizzle-orm";

import { clients, invoices, payments, type DocumentKind, type InvoiceStatus } from "@/db/schema";
import { db } from "@/lib/db";
import { documentPath } from "@/lib/documents";

/**
 * Type-ahead search used by the header search box and the list-page search
 * bars. Matches are prefix based ("t" finds names starting with t) and scoped
 * to the business.
 */

export interface ClientSearchResult {
  id: string;
  name: string;
  type: "b2b" | "b2c";
  email: string | null;
}

export interface InvoiceSearchResult {
  id: string;
  documentKind: DocumentKind;
  invoiceNumber: string;
  clientName: string;
  status: InvoiceStatus;
  total: string;
  currency: string;
  issueDate: string;
}

export interface PaymentSearchResult {
  id: string;
  receiptNumber: string;
  reference: string | null;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  amount: string;
  currency: string;
  paymentDate: string;
}

export interface HistorySearchResult {
  kind: "invoice" | "payment";
  id: string;
  reference: string;
  relatedReference: string | null;
  clientName: string;
  date: string;
  amount: string;
  currency: string;
  href: string;
}

/** Escapes LIKE wildcards so user input is matched literally. */
function prefixPattern(q: string): string {
  return `${q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export async function searchClients(businessId: string, q: string, limit = 8): Promise<ClientSearchResult[]> {
  const pattern = prefixPattern(q);
  return db
    .select({ id: clients.id, name: clients.name, type: clients.type, email: clients.email })
    .from(clients)
    .where(
      and(
        eq(clients.businessId, businessId),
        isNull(clients.archivedAt),
        or(
          ilike(clients.name, pattern),
          ilike(clients.contactName, pattern),
          ilike(clients.email, pattern),
          ilike(clients.phone, pattern),
          ilike(clients.gstin, pattern),
        )!,
      ),
    )
    .orderBy(asc(clients.name))
    .limit(limit);
}

export async function searchInvoices(businessId: string, q: string, limit = 8): Promise<InvoiceSearchResult[]> {
  const pattern = prefixPattern(q);
  return db
    .select({
      id: invoices.id,
      documentKind: invoices.documentKind,
      invoiceNumber: invoices.invoiceNumber,
      clientName: clients.name,
      status: invoices.status,
      total: invoices.total,
      currency: invoices.currency,
      issueDate: invoices.issueDate,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.businessId, businessId), or(ilike(invoices.invoiceNumber, pattern), ilike(clients.name, pattern))!))
    .orderBy(desc(invoices.issueDate), desc(invoices.createdAt))
    .limit(limit);
}

export async function searchPayments(businessId: string, q: string, limit = 8): Promise<PaymentSearchResult[]> {
  const pattern = prefixPattern(q);
  return db
    .select({
      id: payments.id,
      receiptNumber: payments.receiptNumber,
      reference: payments.reference,
      invoiceId: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      clientName: clients.name,
      amount: payments.amount,
      currency: invoices.currency,
      paymentDate: payments.paymentDate,
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(
      and(
        eq(payments.businessId, businessId),
        or(
          ilike(payments.receiptNumber, pattern),
          ilike(payments.reference, pattern),
          ilike(invoices.invoiceNumber, pattern),
          ilike(clients.name, pattern),
        )!,
      ),
    )
    .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
    .limit(limit);
}

/** Invoices and payments merged into one newest-first list for the history page. */
export async function searchHistory(businessId: string, q: string, limit = 8): Promise<HistorySearchResult[]> {
  const [invoiceRows, paymentRows] = await Promise.all([searchInvoices(businessId, q, limit), searchPayments(businessId, q, limit)]);
  const entries: HistorySearchResult[] = [
    ...invoiceRows.map<HistorySearchResult>((inv) => ({
      kind: "invoice",
      id: inv.id,
      reference: inv.invoiceNumber,
      relatedReference: null,
      clientName: inv.clientName,
      date: inv.issueDate,
      amount: inv.total,
      currency: inv.currency,
      href: documentPath(inv.documentKind, inv.id),
    })),
    ...paymentRows.map<HistorySearchResult>((p) => ({
      kind: "payment",
      id: p.id,
      reference: p.receiptNumber,
      relatedReference: p.invoiceNumber,
      clientName: p.clientName,
      date: p.paymentDate,
      amount: p.amount,
      currency: p.currency,
      href: `/dashboard/invoices/${p.invoiceId}`,
    })),
  ];
  return entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, limit);
}
