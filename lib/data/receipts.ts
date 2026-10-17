import { and, asc, eq, inArray } from "drizzle-orm";

import { businesses, clients, invoiceItems, invoices, payments, receipts, type Business, type Client, type Payment, type Receipt } from "@/db/schema";
import { getInvoiceAttribution } from "@/lib/data/attribution";
import { db, type Database } from "@/lib/db";
import { todayIso } from "@/lib/fiscal-year";
import { isZero } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/payment";

/**
 * Receipt data access. A receipt is created the moment a payment is verified
 * (see lib/data/payments.ts) as a frozen snapshot of what the client is told:
 * paid now, total paid so far, balance outstanding, due date and the terms
 * in force. This module never imports lib/data/payments.ts, which imports it.
 */

type Tx = Pick<Database, "select" | "insert" | "update" | "delete" | "execute">;

/** Everything the receipt document needs, loaded from the snapshot plus the issuer and client. */
export interface ReceiptRenderData {
  receipt: Receipt;
  business: Business;
  client: Client;
}

/**
 * Freezes the receipt for a payment that has just been verified. Must run
 * after `applyPaymentTotals`, inside the same transaction, so the cumulative
 * and balance figures are the ones the verification produced.
 */
export async function createReceiptSnapshot(tx: Tx, businessId: string, paymentId: string): Promise<string> {
  const [row] = await tx
    .select({ payment: payments, invoice: invoices, business: businesses })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(businesses, eq(businesses.id, payments.businessId))
    .where(and(eq(payments.businessId, businessId), eq(payments.id, paymentId)))
    .limit(1);
  if (!row) throw new Error("Payment not found.");
  const { payment, invoice, business } = row;
  if (payment.status !== "verified" || !payment.receiptNumber) throw new Error("Receipts are issued for verified payments only.");

  const lines = await tx.select({ description: invoiceItems.description }).from(invoiceItems).where(eq(invoiceItems.invoiceId, invoice.id)).orderBy(asc(invoiceItems.sortOrder));
  const serviceDescription = lines
    .map((l) => l.description.split("\n")[0].trim())
    .filter(Boolean)
    .join("; ")
    .slice(0, 500);

  const [created] = await tx
    .insert(receipts)
    .values({
      businessId,
      paymentId: payment.id,
      invoiceId: invoice.id,
      receiptNumber: payment.receiptNumber,
      currency: invoice.currency,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      methodLabel: PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
      reference: payment.reference,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.issueDate,
      serviceDescription: serviceDescription || null,
      invoiceTotal: invoice.total,
      cumulativePaid: invoice.amountPaid,
      balanceDue: invoice.balanceDue,
      dueDate: invoice.dueDate,
      wasOverdue: invoice.isOverdue || (!isZero(invoice.balanceDue) && invoice.dueDate < todayIso()),
      termsText: business.receiptTerms?.trim() || null,
      privacyUrl: business.receiptPrivacyUrl?.trim() || null,
      termsVersion: business.receiptTermsVersion,
    })
    .onConflictDoNothing({ target: receipts.paymentId })
    .returning({ id: receipts.id });
  if (created) return created.id;
  const [existing] = await tx.select({ id: receipts.id }).from(receipts).where(eq(receipts.paymentId, paymentId)).limit(1);
  return existing.id;
}

/** Marks the receipt void when its payment is reversed. The row and PDF stay for the record. */
export async function voidReceipt(tx: Tx, businessId: string, paymentId: string, reason: string): Promise<void> {
  await tx
    .update(receipts)
    .set({ voidedAt: new Date(), voidReason: reason, updatedAt: new Date() })
    .where(and(eq(receipts.businessId, businessId), eq(receipts.paymentId, paymentId)));
}

export async function getReceiptForPayment(businessId: string, paymentId: string): Promise<Receipt | null> {
  const [row] = await db
    .select()
    .from(receipts)
    .where(and(eq(receipts.businessId, businessId), eq(receipts.paymentId, paymentId)))
    .limit(1);
  return row ?? null;
}

/** Receipt summaries for many payments (invoice page), keyed by payment id. PDF bytes are not loaded. */
export async function mapReceipts(businessId: string, paymentIds: string[]): Promise<Map<string, Omit<Receipt, "pdf">>> {
  const map = new Map<string, Omit<Receipt, "pdf">>();
  if (paymentIds.length === 0) return map;
  const rows = await db
    .select({
      id: receipts.id,
      businessId: receipts.businessId,
      paymentId: receipts.paymentId,
      invoiceId: receipts.invoiceId,
      receiptNumber: receipts.receiptNumber,
      issuedAt: receipts.issuedAt,
      currency: receipts.currency,
      amount: receipts.amount,
      paymentDate: receipts.paymentDate,
      methodLabel: receipts.methodLabel,
      reference: receipts.reference,
      invoiceNumber: receipts.invoiceNumber,
      invoiceDate: receipts.invoiceDate,
      serviceDescription: receipts.serviceDescription,
      invoiceTotal: receipts.invoiceTotal,
      cumulativePaid: receipts.cumulativePaid,
      balanceDue: receipts.balanceDue,
      dueDate: receipts.dueDate,
      wasOverdue: receipts.wasOverdue,
      termsText: receipts.termsText,
      privacyUrl: receipts.privacyUrl,
      termsVersion: receipts.termsVersion,
      pdfGeneratedAt: receipts.pdfGeneratedAt,
      deliveryStatus: receipts.deliveryStatus,
      sentCount: receipts.sentCount,
      lastSentAt: receipts.lastSentAt,
      lastSentTo: receipts.lastSentTo,
      lastError: receipts.lastError,
      voidedAt: receipts.voidedAt,
      voidReason: receipts.voidReason,
      createdAt: receipts.createdAt,
      updatedAt: receipts.updatedAt,
    })
    .from(receipts)
    .where(and(eq(receipts.businessId, businessId), inArray(receipts.paymentId, paymentIds)));
  for (const r of rows) map.set(r.paymentId, r);
  return map;
}

export async function loadReceiptRenderData(businessId: string, paymentId: string): Promise<ReceiptRenderData | null> {
  const [row] = await db
    .select({ receipt: receipts, business: businesses, client: clients })
    .from(receipts)
    .innerJoin(invoices, eq(invoices.id, receipts.invoiceId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .innerJoin(businesses, eq(businesses.id, receipts.businessId))
    .where(and(eq(receipts.businessId, businessId), eq(receipts.paymentId, paymentId)))
    .limit(1);
  return row ?? null;
}

export type ReceiptRelease = { released: true } | { released: false; reason: string };

/**
 * Whether the receipt may be downloaded or emailed. Finance verification is
 * always required; the business can additionally require the approved sales
 * credit (requirements decision D-07). A voided receipt is never released.
 */
export async function receiptRelease(business: Pick<Business, "id" | "receiptRequiresAttribution">, payment: Pick<Payment, "id" | "invoiceId" | "status">, receipt: Pick<Receipt, "voidedAt"> | null): Promise<ReceiptRelease> {
  if (payment.status !== "verified") return { released: false, reason: "The payment has not been verified by finance." };
  if (!receipt) return { released: false, reason: "No receipt has been issued for this payment yet." };
  if (receipt.voidedAt) return { released: false, reason: "The payment was reversed, so this receipt is void." };
  if (business.receiptRequiresAttribution) {
    const attribution = await getInvoiceAttribution(business.id, payment.invoiceId);
    if (attribution?.status !== "approved") return { released: false, reason: "Your settings release receipts only after the sales credit is approved." };
  }
  return { released: true };
}

/** Stores the rendered PDF the first time it is needed, so later downloads and resends are byte-identical. */
export async function storeReceiptPdf(businessId: string, paymentId: string, pdf: Buffer): Promise<void> {
  await db
    .update(receipts)
    .set({ pdf, pdfGeneratedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(receipts.businessId, businessId), eq(receipts.paymentId, paymentId)));
}

export async function recordReceiptDelivery(businessId: string, paymentId: string, result: { to: string; error?: string | null }): Promise<void> {
  const [current] = await db.select({ sentCount: receipts.sentCount }).from(receipts).where(and(eq(receipts.businessId, businessId), eq(receipts.paymentId, paymentId))).limit(1);
  if (!current) return;
  const failed = !!result.error;
  await db
    .update(receipts)
    .set({
      deliveryStatus: failed ? "failed" : "sent",
      sentCount: failed ? current.sentCount : current.sentCount + 1,
      lastSentAt: new Date(),
      lastSentTo: result.to,
      lastError: result.error ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(receipts.businessId, businessId), eq(receipts.paymentId, paymentId)));
}
