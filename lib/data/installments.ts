import { and, asc, eq, sql } from "drizzle-orm";

import { clients, invoiceInstallments, invoices, type InvoiceInstallment, type InvoiceStatus } from "@/db/schema";
import { db } from "@/lib/db";
import { todayIso } from "@/lib/fiscal-year";
import { installmentOutstanding, installmentState, nextUnpaidInstallment, sumInstallments } from "@/lib/installments";
import { D } from "@/lib/money";
import type { InstallmentPlanValues } from "@/lib/validation/installments";

import { applyPaymentTotals, PAYABLE_STATUSES } from "./invoices";

/**
 * Installment plans ("Recurring" in the app). A plan belongs to exactly one
 * invoice and splits its total into dated parts. Allocation of money to the
 * parts is derived, see lib/data/installment-sync.ts.
 */

/** Statuses an invoice can be in when a plan is created or changed. */
const PLANNABLE_STATUSES: InvoiceStatus[] = [...PAYABLE_STATUSES];

export async function listInstallments(businessId: string, invoiceId: string): Promise<InvoiceInstallment[]> {
  return db
    .select()
    .from(invoiceInstallments)
    .where(and(eq(invoiceInstallments.businessId, businessId), eq(invoiceInstallments.invoiceId, invoiceId)))
    .orderBy(asc(invoiceInstallments.sequence));
}

/**
 * Creates or replaces the plan for an invoice. The rows must add up to the
 * invoice total exactly. Money already received is re-allocated to the new
 * rows, and the invoice's due date and status follow the plan.
 */
export async function saveInstallmentPlan(businessId: string, invoiceId: string, values: InstallmentPlanValues): Promise<void> {
  await db.transaction(async (tx) => {
    const [invoice] = await tx
      .select({ id: invoices.id, documentKind: invoices.documentKind, status: invoices.status, total: invoices.total, currency: invoices.currency })
      .from(invoices)
      .where(and(eq(invoices.businessId, businessId), eq(invoices.id, invoiceId)))
      .for("update")
      .limit(1);
    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.documentKind !== "invoice") throw new Error("Installment plans can only be set on invoices.");
    if (!PLANNABLE_STATUSES.includes(invoice.status)) {
      throw new Error(`An installment plan cannot be set on a ${invoice.status} invoice.`);
    }

    const sum = sumInstallments(values.installments);
    if (!D(sum).equals(D(invoice.total))) {
      throw new Error(`Installments add up to ${sum} ${invoice.currency} but the invoice total is ${invoice.total} ${invoice.currency}.`);
    }

    await tx.delete(invoiceInstallments).where(eq(invoiceInstallments.invoiceId, invoiceId));
    await tx.insert(invoiceInstallments).values(
      values.installments.map((row, i) => ({
        businessId,
        invoiceId,
        sequence: i + 1,
        dueDate: row.dueDate,
        amount: row.amount,
      })),
    );
    await applyPaymentTotals(tx, invoiceId);
  });
}

/** Removes the plan. The invoice keeps the last installment's date as its due date. */
export async function deleteInstallmentPlan(businessId: string, invoiceId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [invoice] = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.businessId, businessId), eq(invoices.id, invoiceId)))
      .for("update")
      .limit(1);
    if (!invoice) throw new Error("Invoice not found.");
    const rows = await tx.select({ dueDate: invoiceInstallments.dueDate }).from(invoiceInstallments).where(eq(invoiceInstallments.invoiceId, invoiceId)).orderBy(asc(invoiceInstallments.sequence));
    if (rows.length === 0) return;
    await tx.delete(invoiceInstallments).where(eq(invoiceInstallments.invoiceId, invoiceId));
    await tx.update(invoices).set({ dueDate: rows[rows.length - 1].dueDate, updatedAt: new Date() }).where(eq(invoices.id, invoiceId));
    await applyPaymentTotals(tx, invoiceId);
  });
}

export interface InstallmentPlanSummary {
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus: InvoiceStatus;
  clientId: string;
  clientName: string;
  currency: string;
  total: string;
  balanceDue: string;
  count: number;
  paidCount: number;
  overdueCount: number;
  /** Next unpaid installment, null once the plan is fully paid. */
  next: { sequence: number; dueDate: string; outstanding: string } | null;
  /** Date the last installment falls due. */
  endDate: string;
}

/** Every plan of the business, one row per invoice, soonest next installment first. */
export async function listInstallmentPlans(businessId: string): Promise<InstallmentPlanSummary[]> {
  const rows = await db
    .select({
      installment: invoiceInstallments,
      invoiceNumber: invoices.invoiceNumber,
      invoiceStatus: invoices.status,
      currency: invoices.currency,
      total: invoices.total,
      balanceDue: invoices.balanceDue,
      clientId: clients.id,
      clientName: clients.name,
    })
    .from(invoiceInstallments)
    .innerJoin(invoices, eq(invoices.id, invoiceInstallments.invoiceId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(eq(invoiceInstallments.businessId, businessId))
    .orderBy(asc(invoiceInstallments.invoiceId), asc(invoiceInstallments.sequence));

  const today = todayIso();
  const byInvoice = new Map<string, { meta: Omit<InstallmentPlanSummary, "count" | "paidCount" | "overdueCount" | "next" | "endDate">; rows: InvoiceInstallment[] }>();
  for (const r of rows) {
    const entry = byInvoice.get(r.installment.invoiceId) ?? {
      meta: {
        invoiceId: r.installment.invoiceId,
        invoiceNumber: r.invoiceNumber,
        invoiceStatus: r.invoiceStatus,
        clientId: r.clientId,
        clientName: r.clientName,
        currency: r.currency,
        total: r.total,
        balanceDue: r.balanceDue,
      },
      rows: [],
    };
    entry.rows.push(r.installment);
    byInvoice.set(r.installment.invoiceId, entry);
  }

  const plans: InstallmentPlanSummary[] = [];
  for (const { meta, rows: list } of byInvoice.values()) {
    const states = list.map((i) => installmentState(i, today));
    const next = nextUnpaidInstallment(list);
    plans.push({
      ...meta,
      count: list.length,
      paidCount: states.filter((s) => s === "paid").length,
      overdueCount: states.filter((s) => s === "overdue").length,
      next: next ? { sequence: next.sequence, dueDate: next.dueDate, outstanding: installmentOutstanding(next) } : null,
      endDate: list[list.length - 1].dueDate,
    });
  }
  // Active plans first (soonest next date), settled plans last.
  plans.sort((a, b) => {
    if (!!a.next !== !!b.next) return a.next ? -1 : 1;
    if (a.next && b.next && a.next.dueDate !== b.next.dueDate) return a.next.dueDate < b.next.dueDate ? -1 : 1;
    return a.invoiceNumber.localeCompare(b.invoiceNumber);
  });
  return plans;
}

/** Number of invoices whose next installment is due today or overdue, for badges. */
export async function countInstallmentsDue(businessId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${invoiceInstallments.invoiceId})`.mapWith(Number) })
    .from(invoiceInstallments)
    .where(and(eq(invoiceInstallments.businessId, businessId), sql`${invoiceInstallments.paidAmount} < ${invoiceInstallments.amount}`, sql`${invoiceInstallments.dueDate} <= current_date`));
  return row?.count ?? 0;
}
