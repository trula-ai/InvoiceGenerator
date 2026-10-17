import { and, desc, eq, notInArray, sql } from "drizzle-orm";

import { clients, invoiceItems, invoices } from "@/db/schema";
import { db } from "@/lib/db";

export interface InvoicePickerOption {
  id: string;
  invoiceNumber: string;
  clientName: string;
  issueDate: string;
  total: string;
  currency: string;
  status: string;
  /** Number of line items; shown in the schedule preview. */
  itemCount: number;
}

/**
 * Issued invoices a business can pick as the template for a schedule:
 * real invoices only (not quotes or credit notes), never drafts or cancelled
 * ones, newest first.
 */
export async function listInvoicePickerOptions(businessId: string, limit = 300): Promise<InvoicePickerOption[]> {
  return db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      clientName: clients.name,
      issueDate: invoices.issueDate,
      total: invoices.total,
      currency: invoices.currency,
      status: invoices.status,
      itemCount: sql<number>`(select count(*) from ${invoiceItems} where ${invoiceItems.invoiceId} = ${invoices.id})`.mapWith(Number),
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.businessId, businessId), eq(invoices.documentKind, "invoice"), notInArray(invoices.status, ["draft", "cancelled"])))
    .orderBy(desc(invoices.issueDate), desc(invoices.createdAt))
    .limit(limit);
}
