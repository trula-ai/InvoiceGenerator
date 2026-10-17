import { and, desc, eq, inArray, notExists, sql } from "drizzle-orm";

import { clients, invoiceInstallments, invoices } from "@/db/schema";
import { db } from "@/lib/db";

import { PAYABLE_STATUSES } from "./invoices";

export interface InstallmentCandidate {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  total: string;
  balanceDue: string;
  currency: string;
  status: string;
}

/**
 * Unpaid invoices that do not have an installment plan yet: the ones that can
 * be split into recurring (EMI) payments from the Recurring payments page.
 */
export async function listInstallmentCandidates(businessId: string, limit = 300): Promise<InstallmentCandidate[]> {
  return db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      clientId: clients.id,
      clientName: clients.name,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      total: invoices.total,
      balanceDue: invoices.balanceDue,
      currency: invoices.currency,
      status: invoices.status,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(
      and(
        eq(invoices.businessId, businessId),
        eq(invoices.documentKind, "invoice"),
        inArray(invoices.status, PAYABLE_STATUSES),
        sql`${invoices.balanceDue} > 0`,
        notExists(db.select({ one: sql`1` }).from(invoiceInstallments).where(eq(invoiceInstallments.invoiceId, invoices.id))),
      ),
    )
    .orderBy(desc(invoices.issueDate), desc(invoices.createdAt))
    .limit(limit);
}
