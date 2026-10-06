import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";

import {
  businesses,
  clients,
  emailLogs,
  invoiceItems,
  invoices,
  payments,
  type Business,
  type Client,
  type EmailLog,
  type Invoice,
  type InvoiceItem,
  type InvoiceStatus,
  type Payment,
} from "@/db/schema";
import { calculateBalance, calculateInvoice } from "@/lib/calculations";
import { notifyInvoiceEvent } from "@/lib/data/notifications";
import { db, type Database } from "@/lib/db";
import { nextInvoiceNumber } from "@/lib/document-number";
import { todayIso } from "@/lib/fiscal-year";
import { stateNameForCode } from "@/lib/india-states";
import { D, isPositive, isZero, toInr } from "@/lib/money";
import type { InvoiceFormValues } from "@/lib/validation/invoice";

/**
 * Invoice data access. All functions are tenant-scoped by `businessId`.
 */

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
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
}

export interface InvoiceListFilters {
  q?: string;
  status?: InvoiceStatus | "all";
  clientId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface InvoiceDetail {
  invoice: Invoice;
  client: Client;
  business: Business;
  items: InvoiceItem[];
  payments: Payment[];
  emails: EmailLog[];
}

type Tx = Pick<Database, "select" | "insert" | "update" | "delete" | "execute">;

/** Statuses that can still receive payments. */
export const PAYABLE_STATUSES: InvoiceStatus[] = ["pending", "partially_paid", "overdue"];

/**
 * Promote past-due unpaid invoices to `overdue`. Idempotent and cheap; called
 * at the start of list, dashboard and report loads so filters and counts are
 * always current without a scheduler.
 */
export async function syncOverdueStatuses(businessId: string): Promise<void> {
  await db
    .update(invoices)
    .set({ status: "overdue", updatedAt: new Date() })
    .where(
      and(
        eq(invoices.businessId, businessId),
        inArray(invoices.status, ["pending", "partially_paid"]),
        sql`${invoices.dueDate} < current_date`,
      ),
    );
}

export async function listInvoices(
  businessId: string,
  filters: InvoiceListFilters = {},
): Promise<{ items: InvoiceListItem[]; total: number; page: number; pageSize: number }> {
  await syncOverdueStatuses(businessId);

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));

  const conditions = [eq(invoices.businessId, businessId)];
  if (filters.status && filters.status !== "all") conditions.push(eq(invoices.status, filters.status));
  if (filters.clientId) conditions.push(eq(invoices.clientId, filters.clientId));
  if (filters.from) conditions.push(gte(invoices.issueDate, filters.from));
  if (filters.to) conditions.push(lte(invoices.issueDate, filters.to));
  if (filters.q) {
    const pattern = `%${filters.q.trim()}%`;
    conditions.push(or(ilike(invoices.invoiceNumber, pattern), ilike(clients.name, pattern))!);
  }

  const where = and(...conditions);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(where);

  const items = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
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
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(where)
    .orderBy(desc(invoices.issueDate), desc(invoices.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items, total: countRow?.count ?? 0, page, pageSize };
}

/** 192-bit URL-safe token for the public invoice link. */
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

export async function getInvoiceDetail(businessId: string, id: string): Promise<InvoiceDetail | null> {
  const [row] = await db
    .select({ invoice: invoices, client: clients, business: businesses })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .innerJoin(businesses, eq(businesses.id, invoices.businessId))
    .where(and(eq(invoices.businessId, businessId), eq(invoices.id, id)))
    .limit(1);
  if (!row) return null;

  const [items, paymentRows, emails] = await Promise.all([
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(asc(invoiceItems.sortOrder)),
    db.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(desc(payments.paymentDate), desc(payments.createdAt)),
    db.select().from(emailLogs).where(eq(emailLogs.invoiceId, id)).orderBy(desc(emailLogs.createdAt)),
  ]);

  return { invoice: row.invoice, client: row.client, business: row.business, items, payments: paymentRows, emails };
}

/** Everything needed to persist an invoice from validated form values. */
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
  });

  const row = {
    clientId: client.id,
    invoiceType: values.invoiceType,
    issueDate: values.issueDate,
    dueDate: values.dueDate,
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
    total: calc.total,
    totalInr: calc.totalInr,
    notes: values.notes ?? null,
    terms: values.terms ?? null,
  };

  const itemRows = values.items.map((item, i) => ({
    sortOrder: i,
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

  return { row, itemRows, total: calc.total };
}

export async function createInvoice(business: Business, values: InvoiceFormValues): Promise<string> {
  const { row, itemRows, total } = await buildInvoiceRow(business, values);
  const status: InvoiceStatus = values.status === "pending" && values.dueDate < todayIso() ? "overdue" : values.status;

  return db.transaction(async (tx) => {
    const { invoiceNumber, financialYear } = await nextInvoiceNumber(tx, business.id, business.invoicePrefix, values.issueDate);
    const [created] = await tx
      .insert(invoices)
      .values({
        ...row,
        businessId: business.id,
        invoiceNumber,
        financialYear,
        publicToken: newPublicToken(),
        status,
        amountPaid: "0",
        balanceDue: total,
      })
      .returning({ id: invoices.id });
    if (itemRows.length) {
      await tx.insert(invoiceItems).values(itemRows.map((item) => ({ ...item, invoiceId: created.id })));
    }
    return created.id;
  });
}

/** Editable only while no money has been received. */
export function isInvoiceEditable(invoice: Pick<Invoice, "status" | "amountPaid">): boolean {
  return ["draft", "pending", "overdue"].includes(invoice.status) && isZero(invoice.amountPaid);
}

export async function updateInvoice(business: Business, id: string, values: InvoiceFormValues): Promise<void> {
  const [existing] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.businessId, business.id), eq(invoices.id, id)))
    .limit(1);
  if (!existing) throw new Error("Invoice not found.");
  if (!isInvoiceEditable(existing)) throw new Error("This invoice has payments recorded and can no longer be edited.");

  const { row, itemRows, total } = await buildInvoiceRow(business, values);
  const keepDraft = existing.status === "draft" && values.status === "draft";
  const status: InvoiceStatus = keepDraft ? "draft" : values.dueDate < todayIso() ? "overdue" : "pending";

  await db.transaction(async (tx) => {
    await tx
      .update(invoices)
      .set({ ...row, status, balanceDue: total, updatedAt: new Date() })
      .where(eq(invoices.id, id));
    await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    if (itemRows.length) {
      await tx.insert(invoiceItems).values(itemRows.map((item) => ({ ...item, invoiceId: id })));
    }
  });
}

/** Draft -> pending (or overdue if already past due). */
export async function issueInvoice(businessId: string, id: string): Promise<void> {
  const [existing] = await db
    .select({ status: invoices.status, dueDate: invoices.dueDate })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), eq(invoices.id, id)))
    .limit(1);
  if (!existing) throw new Error("Invoice not found.");
  if (existing.status !== "draft") throw new Error("Only draft invoices can be issued.");
  const status: InvoiceStatus = existing.dueDate < todayIso() ? "overdue" : "pending";
  await db.update(invoices).set({ status, updatedAt: new Date() }).where(eq(invoices.id, id));
  await notifyInvoiceEvent(businessId, id, "invoice_issued");
}

export async function cancelInvoice(businessId: string, id: string): Promise<void> {
  const [existing] = await db
    .select({ status: invoices.status, amountPaid: invoices.amountPaid })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), eq(invoices.id, id)))
    .limit(1);
  if (!existing) throw new Error("Invoice not found.");
  if (!isZero(existing.amountPaid)) throw new Error("Invoices with payments cannot be cancelled.");
  if (existing.status === "cancelled") return;
  await db.update(invoices).set({ status: "cancelled", updatedAt: new Date() }).where(eq(invoices.id, id));
  await notifyInvoiceEvent(businessId, id, "invoice_cancelled");
}

export async function deleteDraftInvoice(businessId: string, id: string): Promise<void> {
  const [existing] = await db
    .select({ status: invoices.status })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), eq(invoices.id, id)))
    .limit(1);
  if (!existing) throw new Error("Invoice not found.");
  if (existing.status !== "draft") throw new Error("Only draft invoices can be deleted. Cancel it instead.");
  await db.delete(invoices).where(eq(invoices.id, id));
}

export async function markInvoiceSent(businessId: string, id: string): Promise<void> {
  const [existing] = await db
    .select({ status: invoices.status, dueDate: invoices.dueDate })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), eq(invoices.id, id)))
    .limit(1);
  if (!existing) return;
  const status: InvoiceStatus =
    existing.status === "draft" ? (existing.dueDate < todayIso() ? "overdue" : "pending") : existing.status;
  await db.update(invoices).set({ sentAt: new Date(), status, updatedAt: new Date() }).where(eq(invoices.id, id));
}

/**
 * Recomputes amountPaid, balanceDue and status from the payments ledger.
 * Called inside the same transaction that inserts or deletes a payment.
 */
export async function applyPaymentTotals(tx: Tx, invoiceId: string): Promise<void> {
  const [inv] = await tx
    .select({ total: invoices.total, dueDate: invoices.dueDate, status: invoices.status, paidAt: invoices.paidAt })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!inv) throw new Error("Invoice not found.");

  const [agg] = await tx
    .select({ paid: sql<string>`coalesce(sum(${payments.amount}), 0)::text` })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId));

  const amountPaid = D(agg?.paid ?? 0).toFixed(2);
  const balanceDue = calculateBalance(inv.total, amountPaid);

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
      balanceDue,
      status,
      paidAt: status === "paid" ? (inv.paidAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));
}

/** INR value of an amount using the invoice's frozen rate. */
export function invoiceAmountToInr(invoice: Pick<Invoice, "exchangeRate">, amount: string): string {
  return toInr(amount, invoice.exchangeRate);
}
