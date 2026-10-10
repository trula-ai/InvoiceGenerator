import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  businesses,
  clients,
  emailLogs,
  invoiceItems,
  invoices,
  payments,
  type Business,
  type Client,
  type DocumentKind,
  type EmailLog,
  type Invoice,
  type InvoiceItem,
  type InvoiceStatus,
  type Payment,
} from "@/db/schema";
import { calculateBalance, calculateInvoice } from "@/lib/calculations";
import { notifyInvoiceEvent } from "@/lib/data/notifications";
import { db, type Database } from "@/lib/db";
import { nextDocumentNumber } from "@/lib/document-number";
import { QUOTE_CONVERTIBLE_STATUSES, QUOTE_OPEN_STATUSES, documentLabel } from "@/lib/documents";
import { addDaysIso, todayIso } from "@/lib/fiscal-year";
import { stateNameForCode } from "@/lib/india-states";
import { D, compare, isPositive, isZero, toInr, toMoney } from "@/lib/money";
import type { InvoiceFormValues } from "@/lib/validation/invoice";

/**
 * Document data access for invoices, quotes and credit notes (one table, see
 * db/schema/invoices.ts). All functions are tenant-scoped by `businessId`.
 */

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  documentKind: DocumentKind;
  clientId: string;
  clientName: string;
  invoiceType: "b2b" | "b2c";
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  currency: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  totalInr: string;
  lastReminderAt: Date | null;
  /** Number of the related document: the invoice a credit note is against, or the quote an invoice came from. */
  sourceNumber: string | null;
}

export interface InvoiceListFilters {
  /** Which document kind to list; defaults to invoices. */
  kind?: DocumentKind;
  q?: string;
  status?: InvoiceStatus | "all";
  clientId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/** A linked document shown on detail pages (source quote, converted invoice, credit notes). */
export interface RelatedDocument {
  id: string;
  invoiceNumber: string;
  documentKind: DocumentKind;
  status: InvoiceStatus;
  issueDate: string;
  total: string;
  currency: string;
}

export interface InvoiceDetail {
  invoice: Invoice;
  client: Client;
  business: Business;
  items: InvoiceItem[];
  payments: Payment[];
  emails: EmailLog[];
  /** Quote this invoice came from, or invoice this credit note is against. */
  source: RelatedDocument | null;
  /** For quotes: the invoice it was converted into. */
  convertedTo: RelatedDocument | null;
  /** For invoices: credit notes issued against it (any status except deleted drafts). */
  creditNotes: RelatedDocument[];
}

type Tx = Pick<Database, "select" | "insert" | "update" | "delete" | "execute">;

/** Statuses that can still receive payments. */
export const PAYABLE_STATUSES: InvoiceStatus[] = ["pending", "partially_paid", "overdue"];

/** Credit notes in these statuses count against their invoice. */
const APPLIED_CREDIT_STATUSES: InvoiceStatus[] = ["pending"];

export interface CreateDocumentOptions {
  kind?: DocumentKind;
  /** Quote an invoice is converted from, or invoice a credit note is issued against. */
  sourceDocumentId?: string | null;
}

/**
 * Promote past-due unpaid invoices to `overdue` and open quotes past their
 * validity date to `expired`. Idempotent and cheap; called at the start of
 * list, dashboard and report loads so filters and counts are always current.
 */
export async function syncOverdueStatuses(businessId: string): Promise<void> {
  await db
    .update(invoices)
    .set({ status: "overdue", updatedAt: new Date() })
    .where(
      and(
        eq(invoices.businessId, businessId),
        eq(invoices.documentKind, "invoice"),
        inArray(invoices.status, ["pending", "partially_paid"]),
        sql`${invoices.dueDate} < current_date`,
      ),
    );
  await db
    .update(invoices)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(
        eq(invoices.businessId, businessId),
        eq(invoices.documentKind, "quote"),
        eq(invoices.status, "pending"),
        sql`${invoices.dueDate} < current_date`,
      ),
    );
}

export async function listInvoices(
  businessId: string,
  filters: InvoiceListFilters = {},
): Promise<{ items: InvoiceListItem[]; total: number; page: number; pageSize: number }> {
  await syncOverdueStatuses(businessId);

  const kind = filters.kind ?? "invoice";
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const source = alias(invoices, "source");

  const conditions = [eq(invoices.businessId, businessId), eq(invoices.documentKind, kind)];
  if (filters.status && filters.status !== "all") conditions.push(eq(invoices.status, filters.status));
  if (filters.clientId) conditions.push(eq(invoices.clientId, filters.clientId));
  if (filters.from) conditions.push(gte(invoices.issueDate, filters.from));
  if (filters.to) conditions.push(lte(invoices.issueDate, filters.to));
  if (filters.q) {
    const pattern = `%${filters.q.trim()}%`;
    conditions.push(or(ilike(invoices.invoiceNumber, pattern), ilike(clients.name, pattern), ilike(source.invoiceNumber, pattern))!);
  }

  const where = and(...conditions);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .leftJoin(source, eq(source.id, invoices.sourceDocumentId))
    .where(where);

  const items = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      documentKind: invoices.documentKind,
      clientId: invoices.clientId,
      clientName: clients.name,
      invoiceType: invoices.invoiceType,
      status: invoices.status,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      currency: invoices.currency,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      balanceDue: invoices.balanceDue,
      totalInr: invoices.totalInr,
      lastReminderAt: invoices.lastReminderAt,
      sourceNumber: source.invoiceNumber,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .leftJoin(source, eq(source.id, invoices.sourceDocumentId))
    .where(where)
    .orderBy(desc(invoices.issueDate), desc(invoices.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items, total: countRow?.count ?? 0, page, pageSize };
}

/** 192-bit URL-safe token for the public document link. */
export function newPublicToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Public, read-only lookup by share token (no login). Returns the same shape
 * as `getInvoiceDetail` so the PDF renderer can be reused. Drafts are never
 * exposed.
 */
export async function getInvoiceDetailByToken(token: string): Promise<InvoiceDetail | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const [row] = await db
    .select({ id: invoices.id, businessId: invoices.businessId, status: invoices.status })
    .from(invoices)
    .where(eq(invoices.publicToken, token))
    .limit(1);
  if (!row || row.status === "draft") return null;
  return getInvoiceDetail(row.businessId, row.id);
}

const relatedColumns = {
  id: invoices.id,
  invoiceNumber: invoices.invoiceNumber,
  documentKind: invoices.documentKind,
  status: invoices.status,
  issueDate: invoices.issueDate,
  total: invoices.total,
  currency: invoices.currency,
};

async function getRelated(businessId: string, id: string | null): Promise<RelatedDocument | null> {
  if (!id) return null;
  const [row] = await db
    .select(relatedColumns)
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), eq(invoices.id, id)))
    .limit(1);
  return row ?? null;
}

export async function getInvoiceDetail(businessId: string, id: string): Promise<InvoiceDetail | null> {
  const [row] = await db
    .select({ invoice: invoices, client: clients, business: businesses })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .innerJoin(businesses, eq(businesses.id, invoices.businessId))
    .where(and(eq(invoices.businessId, businessId), eq(invoices.id, id)))
    .limit(1);
  if (!row) return null;

  const [items, paymentRows, emails, source, convertedTo, creditNotes] = await Promise.all([
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(asc(invoiceItems.sortOrder)),
    db.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(desc(payments.paymentDate), desc(payments.createdAt)),
    db.select().from(emailLogs).where(eq(emailLogs.invoiceId, id)).orderBy(desc(emailLogs.createdAt)),
    getRelated(businessId, row.invoice.sourceDocumentId),
    getRelated(businessId, row.invoice.convertedToId),
    row.invoice.documentKind === "invoice"
      ? db
          .select(relatedColumns)
          .from(invoices)
          .where(and(eq(invoices.businessId, businessId), eq(invoices.sourceDocumentId, id), eq(invoices.documentKind, "credit_note")))
          .orderBy(desc(invoices.issueDate), desc(invoices.createdAt))
      : Promise.resolve([] as RelatedDocument[]),
  ]);

  return { invoice: row.invoice, client: row.client, business: row.business, items, payments: paymentRows, emails, source, convertedTo, creditNotes };
}

/** Everything needed to persist a document from validated form values. */
async function buildInvoiceRow(business: Business, values: InvoiceFormValues) {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.businessId, business.id), eq(clients.id, values.clientId)))
    .limit(1);
  if (!client) throw new Error("Client not found.");

  const gstApplied = business.gstEnabled;
  const placeOfSupplyCode = values.placeOfSupplyCode ?? client.stateCode ?? business.stateCode ?? null;
  const isInterState = gstApplied && !!placeOfSupplyCode && placeOfSupplyCode !== business.stateCode;

  const calc = calculateInvoice({
    items: values.items,
    discountType: values.discountType,
    discountValue: values.discountValue,
    gstEnabled: gstApplied,
    isInterState,
    exchangeRate: values.exchangeRate,
    roundTotals: business.roundTotals,
  });

  const row = {
    clientId: client.id,
    invoiceType: values.invoiceType,
    issueDate: values.issueDate,
    dueDate: values.dueDate,
    poNumber: values.poNumber ?? null,
    reference: values.reference ?? null,
    shipToAddress: values.shipToAddress ?? null,
    currency: values.currency,
    exchangeRate: values.exchangeRate,
    exchangeRateSource: values.exchangeRateSource,
    gstApplied,
    businessGstin: gstApplied ? business.gstin : null,
    clientGstin: gstApplied && values.invoiceType === "b2b" ? client.gstin : null,
    placeOfSupply: stateNameForCode(placeOfSupplyCode),
    placeOfSupplyCode,
    isInterState,
    subtotal: calc.subtotal,
    discountType: values.discountType,
    discountValue: values.discountType === "none" ? "0" : values.discountValue,
    discountAmount: calc.discountAmount,
    taxableAmount: calc.taxableAmount,
    cgstAmount: calc.cgstAmount,
    sgstAmount: calc.sgstAmount,
    igstAmount: calc.igstAmount,
    taxAmount: calc.taxAmount,
    roundOffAmount: calc.roundOffAmount,
    total: calc.total,
    totalInr: calc.totalInr,
    notes: values.notes ?? null,
    terms: values.terms ?? null,
  };

  const itemRows = values.items.map((item, i) => ({
    sortOrder: i,
    itemId: item.itemId ?? null,
    description: item.description,
    hsnSac: item.hsnSac ?? null,
    quantity: item.quantity,
    unit: item.unit ?? null,
    unitPrice: item.unitPrice,
    taxRate: item.taxRate,
    lineSubtotal: calc.items[i].lineSubtotal,
    discountAmount: calc.items[i].discountAmount,
    taxableAmount: calc.items[i].taxableAmount,
    taxAmount: calc.items[i].taxAmount,
    lineTotal: calc.items[i].lineTotal,
  }));

  return { row, itemRows, total: calc.total, client };
}

function prefixFor(business: Business, kind: DocumentKind): string {
  return kind === "quote" ? business.quotePrefix : kind === "credit_note" ? business.creditNotePrefix : business.invoicePrefix;
}

/** Status a document gets when it is issued on `issueDate` with validity/due date `dueDate`. */
function issuedStatus(kind: DocumentKind, dueDate: string): InvoiceStatus {
  if (kind === "credit_note") return "pending";
  if (dueDate < todayIso()) return kind === "quote" ? "expired" : "overdue";
  return "pending";
}

/**
 * Validates that a credit note of `total` may be issued against `sourceId`
 * (same business and currency, an issued invoice, not exceeding what is left
 * to credit) and returns the source row.
 */
async function assertCreditable(tx: Tx, businessId: string, sourceId: string, currency: string, total: string, excludeId?: string): Promise<Invoice> {
  const [source] = await tx
    .select()
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), eq(invoices.id, sourceId)))
    .for("update")
    .limit(1);
  if (!source || source.documentKind !== "invoice") throw new Error("Credit notes must be issued against one of your invoices.");
  if (source.status === "draft" || source.status === "cancelled") throw new Error("That invoice has not been issued, so it cannot be credited.");
  if (source.currency !== currency) throw new Error(`The credit note must be in the invoice currency (${source.currency}).`);

  const [applied] = await tx
    .select({ sum: sql<string>`coalesce(sum(${invoices.total}), 0)::text` })
    .from(invoices)
    .where(
      and(
        eq(invoices.sourceDocumentId, sourceId),
        eq(invoices.documentKind, "credit_note"),
        inArray(invoices.status, APPLIED_CREDIT_STATUSES),
        excludeId ? sql`${invoices.id} <> ${excludeId}` : sql`true`,
      ),
    );
  const remaining = toMoney(D(source.total).minus(D(applied?.sum ?? 0)));
  if (compare(total, remaining) > 0) {
    throw new Error(`The credit note exceeds what is left to credit on ${source.invoiceNumber} (${remaining} ${source.currency}).`);
  }
  return source;
}

export async function createInvoice(business: Business, values: InvoiceFormValues, options: CreateDocumentOptions = {}): Promise<string> {
  const kind = options.kind ?? "invoice";
  const sourceDocumentId = options.sourceDocumentId ?? null;
  const { row, itemRows, total } = await buildInvoiceRow(business, values);
  const status: InvoiceStatus = values.status === "pending" ? issuedStatus(kind, values.dueDate) : "draft";

  if (kind === "credit_note" && !sourceDocumentId) throw new Error("A credit note needs an invoice to credit.");

  return db.transaction(async (tx) => {
    if (kind === "credit_note" && status !== "draft") {
      await assertCreditable(tx, business.id, sourceDocumentId!, values.currency, total);
    }
    const { invoiceNumber, financialYear } = await nextDocumentNumber(tx, business.id, kind, prefixFor(business, kind), values.issueDate);
    const [created] = await tx
      .insert(invoices)
      .values({
        ...row,
        businessId: business.id,
        documentKind: kind,
        sourceDocumentId,
        invoiceNumber,
        financialYear,
        publicToken: newPublicToken(),
        status,
        amountPaid: "0",
        creditAmount: "0",
        balanceDue: kind === "invoice" ? total : "0",
      })
      .returning({ id: invoices.id });
    if (itemRows.length) {
      await tx.insert(invoiceItems).values(itemRows.map((item) => ({ ...item, invoiceId: created.id })));
    }
    if (kind === "credit_note" && status !== "draft") {
      await applyPaymentTotals(tx, sourceDocumentId!);
      await notifyInvoiceEvent(business.id, created.id, "credit_note_issued", {}, tx);
    }
    return created.id;
  });
}

/**
 * Whether the document can still be edited: invoices until money is received,
 * quotes until they are accepted, declined or converted, credit notes until
 * cancelled. Drafts are always editable.
 */
export function isInvoiceEditable(invoice: Pick<Invoice, "status" | "amountPaid" | "documentKind">): boolean {
  switch (invoice.documentKind) {
    case "quote":
      return ["draft", "pending", "expired"].includes(invoice.status);
    case "credit_note":
      return ["draft", "pending"].includes(invoice.status);
    default:
      return ["draft", "pending", "overdue"].includes(invoice.status) && isZero(invoice.amountPaid);
  }
}

export async function updateInvoice(business: Business, id: string, values: InvoiceFormValues): Promise<void> {
  const [existing] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.businessId, business.id), eq(invoices.id, id)))
    .limit(1);
  if (!existing) throw new Error("Document not found.");
  if (!isInvoiceEditable(existing)) {
    throw new Error(
      existing.documentKind === "invoice"
        ? "This invoice has payments recorded and can no longer be edited."
        : `This ${documentLabel(existing.documentKind).toLowerCase()} can no longer be edited.`,
    );
  }

  const { row, itemRows, total } = await buildInvoiceRow(business, values);
  const keepDraft = existing.status === "draft" && values.status === "draft";
  const status: InvoiceStatus = keepDraft ? "draft" : issuedStatus(existing.documentKind, values.dueDate);
  const kind = existing.documentKind;

  await db.transaction(async (tx) => {
    if (kind === "credit_note" && status !== "draft") {
      await assertCreditable(tx, business.id, existing.sourceDocumentId!, values.currency, total, id);
    }
    await tx
      .update(invoices)
      .set({ ...row, status, balanceDue: kind === "invoice" ? total : "0", updatedAt: new Date() })
      .where(eq(invoices.id, id));
    await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    if (itemRows.length) {
      await tx.insert(invoiceItems).values(itemRows.map((item) => ({ ...item, invoiceId: id })));
    }
    if (kind === "credit_note" && existing.sourceDocumentId) {
      await applyPaymentTotals(tx, existing.sourceDocumentId);
      if (existing.status === "draft" && status !== "draft") await notifyInvoiceEvent(business.id, id, "credit_note_issued", {}, tx);
    }
  });
}

/** Draft -> issued (pending; overdue/expired if already past the date). */
export async function issueInvoice(businessId: string, id: string): Promise<void> {
  const [existing] = await db
    .select({ status: invoices.status, dueDate: invoices.dueDate, documentKind: invoices.documentKind, sourceDocumentId: invoices.sourceDocumentId, currency: invoices.currency, total: invoices.total })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), eq(invoices.id, id)))
    .limit(1);
  if (!existing) throw new Error("Document not found.");
  if (existing.status !== "draft") throw new Error(`Only draft ${documentLabel(existing.documentKind).toLowerCase()}s can be issued.`);
  const status = issuedStatus(existing.documentKind, existing.dueDate);

  await db.transaction(async (tx) => {
    if (existing.documentKind === "credit_note") {
      if (!existing.sourceDocumentId) throw new Error("This credit note is not linked to an invoice.");
      await assertCreditable(tx, businessId, existing.sourceDocumentId, existing.currency, existing.total, id);
    }
    await tx.update(invoices).set({ status, updatedAt: new Date() }).where(eq(invoices.id, id));
    if (existing.documentKind === "credit_note") {
      await applyPaymentTotals(tx, existing.sourceDocumentId!);
      await notifyInvoiceEvent(businessId, id, "credit_note_issued", {}, tx);
    } else {
      await notifyInvoiceEvent(businessId, id, "invoice_issued", {}, tx);
    }
  });
}

export async function cancelInvoice(businessId: string, id: string): Promise<void> {
  const [existing] = await db
    .select({ status: invoices.status, amountPaid: invoices.amountPaid, documentKind: invoices.documentKind, sourceDocumentId: invoices.sourceDocumentId })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), eq(invoices.id, id)))
    .limit(1);
  if (!existing) throw new Error("Document not found.");
  if (!isZero(existing.amountPaid)) throw new Error("Invoices with payments cannot be cancelled.");
  if (existing.status === "converted") throw new Error("A converted quote cannot be cancelled; cancel the invoice instead.");
  if (existing.status === "cancelled") return;

  await db.transaction(async (tx) => {
    await tx.update(invoices).set({ status: "cancelled", updatedAt: new Date() }).where(eq(invoices.id, id));
    if (existing.documentKind === "credit_note" && existing.sourceDocumentId) await applyPaymentTotals(tx, existing.sourceDocumentId);
    await notifyInvoiceEvent(businessId, id, "invoice_cancelled", {}, tx);
  });
}

export async function deleteDraftInvoice(businessId: string, id: string): Promise<void> {
  const [existing] = await db
    .select({ status: invoices.status })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), eq(invoices.id, id)))
    .limit(1);
  if (!existing) throw new Error("Document not found.");
  if (existing.status !== "draft") throw new Error("Only drafts can be deleted. Cancel it instead.");
  await db.delete(invoices).where(eq(invoices.id, id));
}

export async function markInvoiceSent(businessId: string, id: string): Promise<void> {
  const [existing] = await db
    .select({ status: invoices.status, dueDate: invoices.dueDate, documentKind: invoices.documentKind })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), eq(invoices.id, id)))
    .limit(1);
  if (!existing) return;
  const status: InvoiceStatus = existing.status === "draft" ? issuedStatus(existing.documentKind, existing.dueDate) : existing.status;
  await db.update(invoices).set({ sentAt: new Date(), status, updatedAt: new Date() }).where(eq(invoices.id, id));
}

/**
 * Recomputes amountPaid, creditAmount, balanceDue and status of an invoice
 * from its payments and issued credit notes. Called inside the same
 * transaction that inserts or deletes a payment or issues/cancels a credit note.
 */
export async function applyPaymentTotals(tx: Tx, invoiceId: string): Promise<void> {
  const [inv] = await tx
    .select({ total: invoices.total, dueDate: invoices.dueDate, status: invoices.status, paidAt: invoices.paidAt, documentKind: invoices.documentKind })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!inv) throw new Error("Invoice not found.");
  if (inv.documentKind !== "invoice") return;

  const [agg] = await tx
    .select({ paid: sql<string>`coalesce(sum(${payments.amount}), 0)::text` })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId));
  const [credits] = await tx
    .select({ sum: sql<string>`coalesce(sum(${invoices.total}), 0)::text` })
    .from(invoices)
    .where(and(eq(invoices.sourceDocumentId, invoiceId), eq(invoices.documentKind, "credit_note"), inArray(invoices.status, APPLIED_CREDIT_STATUSES)));

  const amountPaid = D(agg?.paid ?? 0).toFixed(2);
  const creditAmount = D(credits?.sum ?? 0).toFixed(2);
  const balanceDue = calculateBalance(inv.total, D(amountPaid).plus(D(creditAmount)));

  let status: InvoiceStatus;
  if (inv.status === "cancelled" || inv.status === "draft") {
    status = inv.status;
  } else if (isZero(balanceDue)) {
    status = "paid";
  } else if (isPositive(amountPaid)) {
    status = inv.dueDate < todayIso() ? "overdue" : "partially_paid";
  } else {
    status = inv.dueDate < todayIso() ? "overdue" : "pending";
  }

  await tx
    .update(invoices)
    .set({
      amountPaid,
      creditAmount,
      balanceDue,
      status,
      paidAt: status === "paid" ? (inv.paidAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));
}

// --- Quotes ------------------------------------------------------------------

export type QuoteDecision = "accepted" | "declined";

async function applyQuoteDecision(businessId: string, id: string, decision: QuoteDecision): Promise<void> {
  await db.transaction(async (tx) => {
    const [quote] = await tx
      .select({ status: invoices.status, documentKind: invoices.documentKind })
      .from(invoices)
      .where(and(eq(invoices.businessId, businessId), eq(invoices.id, id)))
      .for("update")
      .limit(1);
    if (!quote || quote.documentKind !== "quote") throw new Error("Quote not found.");
    if (!QUOTE_OPEN_STATUSES.includes(quote.status)) throw new Error("This quote is no longer open for a response.");
    await tx.update(invoices).set({ status: decision, updatedAt: new Date() }).where(eq(invoices.id, id));
    await notifyInvoiceEvent(businessId, id, decision === "accepted" ? "quote_accepted" : "quote_declined", {}, tx);
  });
}

/** Owner marks a quote accepted or declined from the dashboard. */
export async function respondToQuote(businessId: string, id: string, decision: QuoteDecision): Promise<void> {
  await applyQuoteDecision(businessId, id, decision);
}

/** Client accepts or declines from the public page; the token is the only credential. */
export async function respondToQuoteByToken(token: string, decision: QuoteDecision): Promise<{ businessId: string; id: string } | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const [row] = await db
    .select({ id: invoices.id, businessId: invoices.businessId, documentKind: invoices.documentKind, status: invoices.status })
    .from(invoices)
    .where(eq(invoices.publicToken, token))
    .limit(1);
  if (!row || row.documentKind !== "quote" || row.status === "draft") return null;
  await applyQuoteDecision(row.businessId, row.id, decision);
  return { businessId: row.businessId, id: row.id };
}

/**
 * Turns a quote into an invoice: copies the client, lines, discount, notes and
 * frozen exchange rate, dates the invoice today with the business's payment
 * terms, links both documents and marks the quote converted.
 */
export async function convertQuoteToInvoice(business: Business, quoteId: string): Promise<string> {
  const detail = await getInvoiceDetail(business.id, quoteId);
  if (!detail || detail.invoice.documentKind !== "quote") throw new Error("Quote not found.");
  const { invoice: quote, items } = detail;
  if (quote.convertedToId) throw new Error("This quote has already been converted.");
  if (!QUOTE_CONVERTIBLE_STATUSES.includes(quote.status)) throw new Error(`A ${quote.status} quote cannot be converted.`);

  const today = todayIso();
  const values: InvoiceFormValues = {
    clientId: quote.clientId,
    invoiceType: quote.invoiceType,
    issueDate: today,
    dueDate: addDaysIso(today, business.paymentTermsDays),
    poNumber: quote.poNumber ?? undefined,
    reference: quote.reference ?? undefined,
    shipToAddress: quote.shipToAddress ?? undefined,
    currency: quote.currency,
    exchangeRate: quote.exchangeRate,
    exchangeRateSource: quote.exchangeRateSource,
    placeOfSupplyCode: quote.placeOfSupplyCode ?? undefined,
    discountType: quote.discountType,
    discountValue: quote.discountType === "none" ? "0" : quote.discountValue,
    notes: quote.notes ?? undefined,
    terms: quote.terms ?? undefined,
    items: items.map((i) => ({
      itemId: i.itemId ?? undefined,
      description: i.description,
      hsnSac: i.hsnSac ?? undefined,
      quantity: String(Number(i.quantity)),
      unit: i.unit ?? undefined,
      unitPrice: i.unitPrice,
      taxRate: String(Number(i.taxRate)),
    })),
    status: "pending",
  };

  const invoiceId = await createInvoice(business, values, { kind: "invoice", sourceDocumentId: quote.id });
  await db.update(invoices).set({ status: "converted", convertedToId: invoiceId, updatedAt: new Date() }).where(eq(invoices.id, quote.id));
  await notifyInvoiceEvent(business.id, quote.id, "quote_converted", {});
  await notifyInvoiceEvent(business.id, invoiceId, "invoice_issued", {});
  return invoiceId;
}

/** INR value of an amount using the invoice's frozen rate. */
export function invoiceAmountToInr(invoice: Pick<Invoice, "exchangeRate">, amount: string): string {
  return toInr(amount, invoice.exchangeRate);
}
