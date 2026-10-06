import { sql } from "drizzle-orm";

import { documentCounters } from "@/db/schema";
import type { Database } from "@/lib/db";
import { financialYearFor } from "@/lib/fiscal-year";

/**
 * Sequential document numbers (invoices and receipts).
 *
 * Format: <PREFIX>/<FY>/<NNNN>, e.g. INV/2026-27/0001. The sequence restarts
 * at 0001 every Indian financial year.
 *
 * Safety: the number is produced by ONE statement,
 *
 *   INSERT INTO document_counters (...) VALUES (..., 1)
 *   ON CONFLICT (business_id, kind, financial_year)
 *   DO UPDATE SET last_number = document_counters.last_number + 1
 *   RETURNING last_number
 *
 * PostgreSQL executes the conflicting UPDATE under a row lock, so two requests
 * issuing invoices at the same moment are serialised and receive consecutive
 * numbers. The caller must run this inside the same transaction that inserts
 * the document, so a failed insert rolls the counter back as well. The unique
 * index on (business_id, invoice_number) is a second line of defence.
 */

export type CounterKind = "invoice" | "receipt";

type Executor = Pick<Database, "execute">;

export async function nextSequenceNumber(
  tx: Executor,
  businessId: string,
  kind: CounterKind,
  financialYear: string,
): Promise<number> {
  const result = await tx.execute<{ last_number: number }>(sql`
    insert into ${documentCounters} (business_id, kind, financial_year, last_number)
    values (${businessId}, ${kind}, ${financialYear}, 1)
    on conflict (business_id, kind, financial_year)
    do update set last_number = ${documentCounters}.last_number + 1
    returning last_number
  `);
  const row = (result as unknown as { rows?: { last_number: number }[] }).rows?.[0] ?? (result as unknown as { last_number: number }[])[0];
  if (!row) throw new Error("Failed to allocate a document number.");
  return Number(row.last_number);
}

export function formatDocumentNumber(prefix: string, financialYear: string, sequence: number): string {
  return `${prefix}/${financialYear}/${sequence.toString().padStart(4, "0")}`;
}

/** Allocates the next invoice number for an issue date, inside `tx`. */
export async function nextInvoiceNumber(
  tx: Executor,
  businessId: string,
  prefix: string,
  issueDate: string,
): Promise<{ invoiceNumber: string; financialYear: string }> {
  const financialYear = financialYearFor(issueDate);
  const seq = await nextSequenceNumber(tx, businessId, "invoice", financialYear);
  return { invoiceNumber: formatDocumentNumber(prefix, financialYear, seq), financialYear };
}

/** Allocates the next receipt number for a payment date, inside `tx`. */
export async function nextReceiptNumber(tx: Executor, businessId: string, paymentDate: string): Promise<string> {
  const financialYear = financialYearFor(paymentDate);
  const seq = await nextSequenceNumber(tx, businessId, "receipt", financialYear);
  return formatDocumentNumber("RCPT", financialYear, seq);
}
