import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";

import {
  businesses,
  clients,
  invoices,
  payments,
  type Business,
  type Client,
  type Invoice,
  type Payment,
  type PaymentMethod,
} from "@/db/schema";
import { notifyInvoiceEvent } from "@/lib/data/notifications";
import { db } from "@/lib/db";
import { nextReceiptNumber } from "@/lib/document-number";
import { compare, toInr } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, type PaymentFormValues } from "@/lib/validation/payment";

import { applyPaymentTotals, PAYABLE_STATUSES } from "./invoices";

export interface PaymentListItem extends Payment {
  invoiceNumber: string;
  invoiceCurrency: string;
  clientId: string;
  clientName: string;
}

export interface PaymentListFilters {
  q?: string;
  method?: PaymentMethod | "all";
  from?: string;
  to?: string;
  clientId?: string;
}

export interface PaymentDetail {
  payment: Payment;
  invoice: Invoice;
  client: Client;
  business: Business;
}

export async function listPayments(businessId: string, filters: PaymentListFilters = {}): Promise<PaymentListItem[]> {
  const conditions = [eq(payments.businessId, businessId)];
  if (filters.method && filters.method !== "all") conditions.push(eq(payments.method, filters.method));
  if (filters.from) conditions.push(gte(payments.paymentDate, filters.from));
  if (filters.to) conditions.push(lte(payments.paymentDate, filters.to));
  if (filters.clientId) conditions.push(eq(invoices.clientId, filters.clientId));
  if (filters.q) {
    const pattern = `%${filters.q.trim()}%`;
    conditions.push(
      or(
        ilike(payments.receiptNumber, pattern),
        ilike(payments.reference, pattern),
        ilike(invoices.invoiceNumber, pattern),
        ilike(clients.name, pattern),
      )!,
    );
  }

  const rows = await db
    .select({
      payment: payments,
      invoiceNumber: invoices.invoiceNumber,
      invoiceCurrency: invoices.currency,
      clientId: clients.id,
      clientName: clients.name,
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(...conditions))
    .orderBy(desc(payments.paymentDate), desc(payments.createdAt));

  return rows.map((r) => ({
    ...r.payment,
    invoiceNumber: r.invoiceNumber,
    invoiceCurrency: r.invoiceCurrency,
    clientId: r.clientId,
    clientName: r.clientName,
  }));
}

export async function getPaymentDetail(businessId: string, id: string): Promise<PaymentDetail | null> {
  const [row] = await db
    .select({ payment: payments, invoice: invoices, client: clients, business: businesses })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .innerJoin(businesses, eq(businesses.id, payments.businessId))
    .where(and(eq(payments.businessId, businessId), eq(payments.id, id)))
    .limit(1);
  return row ?? null;
}

/**
 * Records a payment against an invoice. Runs in one transaction that locks the
 * invoice row, validates the amount against the live balance, allocates the
 * receipt number and updates the invoice totals/status.
 */
export async function recordPayment(businessId: string, values: PaymentFormValues): Promise<string> {
  return db.transaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.businessId, businessId), eq(invoices.id, values.invoiceId)))
      .for("update")
      .limit(1);
    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.documentKind !== "invoice") throw new Error("Payments can only be recorded against invoices.");
    if (!PAYABLE_STATUSES.includes(invoice.status)) {
      throw new Error(`Payments cannot be recorded against a ${invoice.status} invoice.`);
    }
    if (compare(values.amount, invoice.balanceDue) > 0) {
      throw new Error(`Amount exceeds the outstanding balance of ${invoice.balanceDue} ${invoice.currency}.`);
    }

    const receiptNumber = await nextReceiptNumber(tx, businessId, values.paymentDate);
    const [created] = await tx
      .insert(payments)
      .values({
        businessId,
        invoiceId: invoice.id,
        receiptNumber,
        amount: values.amount,
        amountInr: toInr(values.amount, invoice.exchangeRate),
        paymentDate: values.paymentDate,
        method: values.method,
        reference: values.reference ?? null,
        notes: values.notes ?? null,
      })
      .returning({ id: payments.id });

    await applyPaymentTotals(tx, invoice.id);

    await notifyInvoiceEvent(
      businessId,
      invoice.id,
      "payment_received",
      {
        amount: values.amount,
        methodLabel: PAYMENT_METHOD_LABELS[values.method],
        reference: values.reference ?? null,
        receiptNumber,
      },
      tx,
    );
    const [after] = await tx.select({ status: invoices.status }).from(invoices).where(eq(invoices.id, invoice.id)).limit(1);
    if (after?.status === "paid") await notifyInvoiceEvent(businessId, invoice.id, "invoice_paid", {}, tx);

    return created.id;
  });
}

export async function deletePayment(businessId: string, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: payments.id, invoiceId: payments.invoiceId })
      .from(payments)
      .where(and(eq(payments.businessId, businessId), eq(payments.id, id)))
      .limit(1);
    if (!existing) throw new Error("Payment not found.");
    await tx.delete(payments).where(eq(payments.id, id));
    await applyPaymentTotals(tx, existing.invoiceId);
  });
}

/** Total collected in INR within a date range (used by dashboard and reports). */
export async function sumPaymentsInr(businessId: string, from?: string, to?: string): Promise<string> {
  const conditions = [eq(payments.businessId, businessId)];
  if (from) conditions.push(gte(payments.paymentDate, from));
  if (to) conditions.push(lte(payments.paymentDate, to));
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${payments.amountInr}), 0)::text` })
    .from(payments)
    .where(and(...conditions));
  return row?.total ?? "0";
}
