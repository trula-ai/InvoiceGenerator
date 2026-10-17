import { and, asc, desc, eq, gte, ilike, inArray, lte, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  businesses,
  clients,
  invoices,
  paymentEvidence,
  payments,
  users,
  type Business,
  type Client,
  type Invoice,
  type Payment,
  type PaymentEvidence,
  type PaymentMethod,
  type PaymentStatus,
} from "@/db/schema";
import { notifyInvoiceEvent } from "@/lib/data/notifications";
import { db, type Database } from "@/lib/db";
import { nextReceiptNumber } from "@/lib/document-number";
import { todayIso } from "@/lib/fiscal-year";
import { compare, toInr } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, type PaymentFormValues } from "@/lib/validation/payment";

import { applyPaymentTotals, PAYABLE_STATUSES } from "./invoices";

/**
 * Payment data access.
 *
 * A payment is a record of money the business says it received. Manual
 * entries start `pending` and only count toward the invoice once a finance
 * user marks them `verified`; gateway payments (Razorpay) arrive verified
 * because the gateway itself is the evidence. Rejected and reversed rows are
 * kept for the audit trail and never deleted; the one exception is a pending
 * entry withdrawn by the business before anyone reviewed it.
 */

type Tx = Pick<Database, "select" | "insert" | "update" | "delete" | "execute">;

/** Evidence files are kept small: they are stored in the database. */
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
export const EVIDENCE_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;

export interface PaymentListItem extends Payment {
  invoiceNumber: string;
  invoiceCurrency: string;
  clientId: string;
  clientName: string;
  recordedByName: string | null;
  reviewedByName: string | null;
}

export interface PaymentListFilters {
  q?: string;
  method?: PaymentMethod | "all";
  status?: PaymentStatus | "all";
  from?: string;
  to?: string;
  clientId?: string;
}

export interface EvidenceSummary {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedByName: string | null;
  createdAt: Date;
}

export interface PaymentDetail {
  payment: Payment;
  invoice: Invoice;
  client: Client;
  business: Business;
  evidence: EvidenceSummary[];
  recordedByName: string | null;
  reviewedByName: string | null;
  reversedByName: string | null;
}

const recordedBy = alias(users, "recorded_by");
const reviewedBy = alias(users, "reviewed_by");
const reversedBy = alias(users, "reversed_by");
const uploadedBy = alias(users, "uploaded_by");

export async function listPayments(businessId: string, filters: PaymentListFilters = {}): Promise<PaymentListItem[]> {
  const conditions = [eq(payments.businessId, businessId)];
  if (filters.method && filters.method !== "all") conditions.push(eq(payments.method, filters.method));
  if (filters.status && filters.status !== "all") conditions.push(eq(payments.status, filters.status));
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
      recordedByName: recordedBy.name,
      reviewedByName: reviewedBy.name,
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .leftJoin(recordedBy, eq(recordedBy.id, payments.recordedByUserId))
    .leftJoin(reviewedBy, eq(reviewedBy.id, payments.reviewedByUserId))
    .where(and(...conditions))
    .orderBy(desc(payments.paymentDate), desc(payments.createdAt));

  return rows.map((r) => ({
    ...r.payment,
    invoiceNumber: r.invoiceNumber,
    invoiceCurrency: r.invoiceCurrency,
    clientId: r.clientId,
    clientName: r.clientName,
    recordedByName: r.recordedByName,
    reviewedByName: r.reviewedByName,
  }));
}

export async function listPaymentEvidence(businessId: string, paymentId: string): Promise<EvidenceSummary[]> {
  const rows = await db
    .select({
      id: paymentEvidence.id,
      fileName: paymentEvidence.fileName,
      contentType: paymentEvidence.contentType,
      sizeBytes: paymentEvidence.sizeBytes,
      uploadedByName: uploadedBy.name,
      createdAt: paymentEvidence.createdAt,
    })
    .from(paymentEvidence)
    .leftJoin(uploadedBy, eq(uploadedBy.id, paymentEvidence.uploadedByUserId))
    .where(and(eq(paymentEvidence.businessId, businessId), eq(paymentEvidence.paymentId, paymentId)))
    .orderBy(asc(paymentEvidence.createdAt));
  return rows;
}

/** Evidence for many payments at once (invoice page, verification queue), keyed by payment id. */
export async function mapPaymentEvidence(businessId: string, paymentIds: string[]): Promise<Map<string, EvidenceSummary[]>> {
  const map = new Map<string, EvidenceSummary[]>();
  if (paymentIds.length === 0) return map;
  const rows = await db
    .select({
      paymentId: paymentEvidence.paymentId,
      id: paymentEvidence.id,
      fileName: paymentEvidence.fileName,
      contentType: paymentEvidence.contentType,
      sizeBytes: paymentEvidence.sizeBytes,
      uploadedByName: uploadedBy.name,
      createdAt: paymentEvidence.createdAt,
    })
    .from(paymentEvidence)
    .leftJoin(uploadedBy, eq(uploadedBy.id, paymentEvidence.uploadedByUserId))
    .where(and(eq(paymentEvidence.businessId, businessId), inArray(paymentEvidence.paymentId, paymentIds)))
    .orderBy(asc(paymentEvidence.createdAt));
  for (const { paymentId, ...rest } of rows) {
    const list = map.get(paymentId) ?? [];
    list.push(rest);
    map.set(paymentId, list);
  }
  return map;
}

export async function getPaymentDetail(businessId: string, id: string): Promise<PaymentDetail | null> {
  const [row] = await db
    .select({
      payment: payments,
      invoice: invoices,
      client: clients,
      business: businesses,
      recordedByName: recordedBy.name,
      reviewedByName: reviewedBy.name,
      reversedByName: reversedBy.name,
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .innerJoin(businesses, eq(businesses.id, payments.businessId))
    .leftJoin(recordedBy, eq(recordedBy.id, payments.recordedByUserId))
    .leftJoin(reviewedBy, eq(reviewedBy.id, payments.reviewedByUserId))
    .leftJoin(reversedBy, eq(reversedBy.id, payments.reversedByUserId))
    .where(and(eq(payments.businessId, businessId), eq(payments.id, id)))
    .limit(1);
  if (!row) return null;
  const evidence = await listPaymentEvidence(businessId, id);
  return { ...row, evidence };
}

/** Full evidence row including the file bytes, for the download route. */
export async function getPaymentEvidenceFile(businessId: string, paymentId: string, evidenceId: string): Promise<PaymentEvidence | null> {
  const [row] = await db
    .select()
    .from(paymentEvidence)
    .where(and(eq(paymentEvidence.businessId, businessId), eq(paymentEvidence.paymentId, paymentId), eq(paymentEvidence.id, evidenceId)))
    .limit(1);
  return row ?? null;
}

export interface DuplicateMatch {
  paymentId: string;
  invoiceNumber: string;
  receiptNumber: string | null;
  amount: string;
  paymentDate: string;
  status: PaymentStatus;
}

/**
 * Other payments of this business that carry the same transaction reference
 * (case-insensitive) and have not been rejected. Used to warn before a bank
 * transfer or UTR is recorded twice, for example once by hand and once by a
 * gateway callback.
 */
export async function findDuplicateReferences(businessId: string, reference: string | null | undefined, excludePaymentId?: string, tx: Tx = db): Promise<DuplicateMatch[]> {
  const ref = reference?.trim();
  if (!ref) return [];
  const conditions = [eq(payments.businessId, businessId), sql`lower(${payments.reference}) = lower(${ref})`, ne(payments.status, "rejected")];
  if (excludePaymentId) conditions.push(ne(payments.id, excludePaymentId));
  return tx
    .select({
      paymentId: payments.id,
      invoiceNumber: invoices.invoiceNumber,
      receiptNumber: payments.receiptNumber,
      amount: payments.amount,
      paymentDate: payments.paymentDate,
      status: payments.status,
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .where(and(...conditions))
    .orderBy(desc(payments.createdAt))
    .limit(5);
}

export class DuplicateReferenceError extends Error {
  constructor(public readonly matches: DuplicateMatch[]) {
    super(
      `A payment with this reference already exists: ${matches
        .map((m) => `${m.receiptNumber ?? "pending"} on ${m.invoiceNumber} (${m.amount})`)
        .join(", ")}. Tick "Record anyway" if this is a different transaction.`,
    );
    this.name = "DuplicateReferenceError";
  }
}

export interface GatewayPaymentInput {
  invoiceId: string;
  amount: string;
  paymentDate: string;
  method: PaymentMethod;
  provider: string;
  providerPaymentId: string;
  providerOrderId: string | null;
  notes?: string | null;
}

/**
 * Records a payment collected by a gateway. Idempotent on
 * (provider, providerPaymentId): a checkout callback and a webhook for the
 * same payment produce one row. Gateway payments are verified on arrival.
 */
export async function recordGatewayPayment(businessId: string, input: GatewayPaymentInput): Promise<{ paymentId: string; created: boolean }> {
  const [existing] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.provider, input.provider), eq(payments.providerPaymentId, input.providerPaymentId)))
    .limit(1);
  if (existing) return { paymentId: existing.id, created: false };

  const values: PaymentFormValues = {
    invoiceId: input.invoiceId,
    amount: input.amount,
    paymentDate: input.paymentDate,
    method: input.method,
    reference: input.providerPaymentId,
    receivingAccount: undefined,
    notes: input.notes ?? undefined,
    allowDuplicate: true,
  };
  const paymentId = await recordPayment(businessId, values, {
    provider: input.provider,
    providerPaymentId: input.providerPaymentId,
    providerOrderId: input.providerOrderId,
    recordedByUserId: null,
    verified: true,
  });
  return { paymentId, created: true };
}

export interface RecordPaymentOptions {
  provider: string;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  /** User typing the payment in; null for gateway payments. */
  recordedByUserId: string | null;
  /** True for gateway payments, which count immediately and get a receipt number. */
  verified: boolean;
}

const MANUAL: RecordPaymentOptions = { provider: "manual", providerPaymentId: null, providerOrderId: null, recordedByUserId: null, verified: false };

/**
 * Records a payment against an invoice. Runs in one transaction that locks the
 * invoice row, validates the amount against the live balance, checks for a
 * duplicate reference and updates the invoice totals. A manual payment is
 * `pending` and does not change the balance until it is verified.
 */
export async function recordPayment(businessId: string, values: PaymentFormValues, options: RecordPaymentOptions = MANUAL): Promise<string> {
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
    // Pending entries also reserve part of the balance, so two people cannot
    // both record the same remaining amount before finance looks at either.
    const [reserved] = await tx
      .select({ pending: sql<string>`coalesce(sum(${payments.amount}), 0)::text` })
      .from(payments)
      .where(and(eq(payments.invoiceId, invoice.id), eq(payments.status, "pending")));
    const available = compare(invoice.balanceDue, reserved?.pending ?? "0") > 0 ? String(Number(invoice.balanceDue) - Number(reserved?.pending ?? 0)) : "0";
    if (compare(values.amount, available) > 0) {
      throw new Error(
        compare(reserved?.pending ?? "0", "0") > 0
          ? `Amount exceeds what is left to record: ${available} ${invoice.currency} (the balance is ${invoice.balanceDue} and ${reserved?.pending} is awaiting verification).`
          : `Amount exceeds the outstanding balance of ${invoice.balanceDue} ${invoice.currency}.`,
      );
    }

    if (!values.allowDuplicate) {
      const duplicates = await findDuplicateReferences(businessId, values.reference, undefined, tx);
      if (duplicates.length > 0) throw new DuplicateReferenceError(duplicates);
    }

    const now = new Date();
    const receiptNumber = options.verified ? await nextReceiptNumber(tx, businessId, values.paymentDate) : null;
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
        receivingAccount: values.receivingAccount ?? null,
        notes: values.notes ?? null,
        provider: options.provider,
        providerPaymentId: options.providerPaymentId,
        providerOrderId: options.providerOrderId,
        status: options.verified ? "verified" : "pending",
        recordedByUserId: options.recordedByUserId,
        reviewedAt: options.verified ? now : null,
      })
      .returning({ id: payments.id });

    const extra = { amount: values.amount, methodLabel: PAYMENT_METHOD_LABELS[values.method], reference: values.reference ?? null, receiptNumber: receiptNumber ?? undefined };
    if (options.verified) {
      await applyPaymentTotals(tx, invoice.id);
      await notifyInvoiceEvent(businessId, invoice.id, "payment_received", extra, tx);
      await notifyIfPaid(tx, businessId, invoice.id);
    } else {
      await notifyInvoiceEvent(businessId, invoice.id, "payment_pending", extra, tx);
    }
    return created.id;
  });
}

async function notifyIfPaid(tx: Tx, businessId: string, invoiceId: string): Promise<void> {
  const [after] = await tx.select({ status: invoices.status }).from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (after?.status === "paid") await notifyInvoiceEvent(businessId, invoiceId, "invoice_paid", {}, tx);
}

async function lockPayment(tx: Tx, businessId: string, id: string): Promise<Payment> {
  const [row] = await tx
    .select()
    .from(payments)
    .where(and(eq(payments.businessId, businessId), eq(payments.id, id)))
    .for("update")
    .limit(1);
  if (!row) throw new Error("Payment not found.");
  return row;
}

/**
 * Finance confirms the money arrived: the payment becomes verified, gets its
 * receipt number and counts toward the invoice balance.
 */
export async function verifyPayment(businessId: string, id: string, reviewerUserId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const payment = await lockPayment(tx, businessId, id);
    if (payment.status !== "pending") throw new Error(`This payment is already ${payment.status}.`);
    const [invoice] = await tx.select({ id: invoices.id, balanceDue: invoices.balanceDue, currency: invoices.currency, status: invoices.status }).from(invoices).where(eq(invoices.id, payment.invoiceId)).for("update").limit(1);
    if (!invoice) throw new Error("Invoice not found.");
    if (!PAYABLE_STATUSES.includes(invoice.status)) throw new Error(`The invoice is ${invoice.status}; reject this payment instead.`);
    if (compare(payment.amount, invoice.balanceDue) > 0) {
      throw new Error(`The payment (${payment.amount} ${invoice.currency}) exceeds the invoice balance of ${invoice.balanceDue} ${invoice.currency}. Reject it and record the correct amount.`);
    }

    const receiptNumber = await nextReceiptNumber(tx, businessId, payment.paymentDate);
    const now = new Date();
    await tx
      .update(payments)
      .set({ status: "verified", receiptNumber, reviewedByUserId: reviewerUserId, reviewedAt: now, rejectionReason: null, updatedAt: now })
      .where(eq(payments.id, id));
    await applyPaymentTotals(tx, payment.invoiceId);
    await notifyInvoiceEvent(
      businessId,
      payment.invoiceId,
      "payment_verified",
      { amount: payment.amount, methodLabel: PAYMENT_METHOD_LABELS[payment.method], reference: payment.reference, receiptNumber },
      tx,
    );
    await notifyIfPaid(tx, businessId, payment.invoiceId);
  });
}

/** Finance could not match the payment to money received. The row stays, with the reason. */
export async function rejectPayment(businessId: string, id: string, reviewerUserId: string, reason: string): Promise<void> {
  await db.transaction(async (tx) => {
    const payment = await lockPayment(tx, businessId, id);
    if (payment.status !== "pending") throw new Error(`This payment is already ${payment.status}.`);
    const now = new Date();
    await tx
      .update(payments)
      .set({ status: "rejected", reviewedByUserId: reviewerUserId, reviewedAt: now, rejectionReason: reason, updatedAt: now })
      .where(eq(payments.id, id));
    await notifyInvoiceEvent(
      businessId,
      payment.invoiceId,
      "payment_rejected",
      { amount: payment.amount, methodLabel: PAYMENT_METHOD_LABELS[payment.method], reference: payment.reference, error: reason },
      tx,
    );
  });
}

/**
 * A verified payment turned out not to be good (refund, bounced transfer,
 * chargeback, entered in error). The invoice balance is restored; the row and
 * its receipt number are kept so the ledger explains the correction.
 */
export async function reversePayment(businessId: string, id: string, actorUserId: string, reason: string): Promise<void> {
  await db.transaction(async (tx) => {
    const payment = await lockPayment(tx, businessId, id);
    if (payment.status !== "verified") throw new Error(`Only verified payments can be reversed; this one is ${payment.status}.`);
    const now = new Date();
    await tx
      .update(payments)
      .set({ status: "reversed", reversedByUserId: actorUserId, reversedAt: now, reversalReason: reason, updatedAt: now })
      .where(eq(payments.id, id));
    await applyPaymentTotals(tx, payment.invoiceId);
    await notifyInvoiceEvent(
      businessId,
      payment.invoiceId,
      "payment_reversed",
      { amount: payment.amount, methodLabel: PAYMENT_METHOD_LABELS[payment.method], reference: payment.reference, receiptNumber: payment.receiptNumber ?? undefined, error: reason },
      tx,
    );
  });
}

/**
 * Removes a pending entry that nobody has reviewed yet (a typo, the wrong
 * invoice). Nothing was counted and no receipt number was issued, so there is
 * nothing to keep. Verified payments must be reversed instead.
 */
export async function withdrawPendingPayment(businessId: string, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const payment = await lockPayment(tx, businessId, id);
    if (payment.status !== "pending") throw new Error(`Only pending payments can be withdrawn; this one is ${payment.status}. Verified payments are reversed, not deleted.`);
    await tx.delete(payments).where(eq(payments.id, id));
  });
}

export interface EvidenceUpload {
  fileName: string;
  contentType: string;
  data: Buffer;
}

/** Attaches proof to a pending or verified payment. */
export async function addPaymentEvidence(businessId: string, paymentId: string, uploadedByUserId: string, file: EvidenceUpload): Promise<string> {
  if (!(EVIDENCE_CONTENT_TYPES as readonly string[]).includes(file.contentType)) {
    throw new Error("Attach a PNG, JPEG, WebP image or a PDF.");
  }
  if (file.data.length === 0) throw new Error("The file is empty.");
  if (file.data.length > EVIDENCE_MAX_BYTES) throw new Error(`Files must be smaller than ${Math.round(EVIDENCE_MAX_BYTES / 1024 / 1024)} MB.`);
  const [payment] = await db
    .select({ id: payments.id, status: payments.status })
    .from(payments)
    .where(and(eq(payments.businessId, businessId), eq(payments.id, paymentId)))
    .limit(1);
  if (!payment) throw new Error("Payment not found.");
  if (payment.status === "rejected" || payment.status === "reversed") throw new Error(`Evidence cannot be added to a ${payment.status} payment.`);
  const [row] = await db
    .insert(paymentEvidence)
    .values({
      businessId,
      paymentId,
      fileName: file.fileName.slice(0, 200),
      contentType: file.contentType,
      sizeBytes: file.data.length,
      data: file.data,
      uploadedByUserId,
    })
    .returning({ id: paymentEvidence.id });
  return row.id;
}

// --- Verification queue ------------------------------------------------------

export interface VerificationQueueItem {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceBalanceDue: string;
  clientId: string;
  clientName: string;
  amount: string;
  currency: string;
  paymentDate: string;
  method: PaymentMethod;
  reference: string | null;
  receivingAccount: string | null;
  notes: string | null;
  recordedByName: string | null;
  createdAt: Date;
  daysPending: number;
  evidence: EvidenceSummary[];
  /** Other non-rejected payments with the same reference. */
  duplicates: DuplicateMatch[];
}

/** Pending manual payments awaiting finance review, oldest first. */
export async function listVerificationQueue(businessId: string): Promise<VerificationQueueItem[]> {
  const rows = await db
    .select({
      id: payments.id,
      invoiceId: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      invoiceBalanceDue: invoices.balanceDue,
      clientId: clients.id,
      clientName: clients.name,
      amount: payments.amount,
      currency: invoices.currency,
      paymentDate: payments.paymentDate,
      method: payments.method,
      reference: payments.reference,
      receivingAccount: payments.receivingAccount,
      notes: payments.notes,
      recordedByName: recordedBy.name,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .leftJoin(recordedBy, eq(recordedBy.id, payments.recordedByUserId))
    .where(and(eq(payments.businessId, businessId), eq(payments.status, "pending")))
    .orderBy(asc(payments.createdAt));

  const evidence = await mapPaymentEvidence(
    businessId,
    rows.map((r) => r.id),
  );
  const today = todayIso();
  const items: VerificationQueueItem[] = [];
  for (const r of rows) {
    const duplicates = await findDuplicateReferences(businessId, r.reference, r.id);
    const created = r.createdAt.toISOString().slice(0, 10);
    const daysPending = Math.max(0, Math.round((Date.parse(today) - Date.parse(created)) / 86_400_000));
    items.push({ ...r, daysPending, evidence: evidence.get(r.id) ?? [], duplicates });
  }
  return items;
}

export async function countPendingPayments(businessId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(payments)
    .where(and(eq(payments.businessId, businessId), eq(payments.status, "pending")));
  return row?.count ?? 0;
}

/** Total collected in INR within a date range, verified payments only (dashboard and reports). */
export async function sumPaymentsInr(businessId: string, from?: string, to?: string): Promise<string> {
  const conditions = [eq(payments.businessId, businessId), eq(payments.status, "verified")];
  if (from) conditions.push(gte(payments.paymentDate, from));
  if (to) conditions.push(lte(payments.paymentDate, to));
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${payments.amountInr}), 0)::text` })
    .from(payments)
    .where(and(...conditions));
  return row?.total ?? "0";
}

/** Verified payments carry a receipt number; used by routes that must refuse the rest. */
export function hasReceipt(payment: Pick<Payment, "status" | "receiptNumber">): payment is Payment & { receiptNumber: string } {
  return payment.status === "verified" && payment.receiptNumber !== null;
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending verification",
  verified: "Verified",
  rejected: "Rejected",
  reversed: "Reversed",
};
