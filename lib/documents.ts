import type { DocumentKind, InvoiceStatus } from "@/db/schema";

/**
 * Document-kind helpers shared by server and client code. Quotes, invoices and
 * credit notes live in one table (see db/schema/invoices.ts); these functions
 * give each kind its labels, routes and status vocabulary.
 */

export const DOCUMENT_KINDS: DocumentKind[] = ["invoice", "quote", "credit_note"];

export function isDocumentKind(value: unknown): value is DocumentKind {
  return typeof value === "string" && (DOCUMENT_KINDS as string[]).includes(value);
}

const LABELS: Record<DocumentKind, { singular: string; plural: string; title: string }> = {
  invoice: { singular: "Invoice", plural: "Invoices", title: "INVOICE" },
  quote: { singular: "Quote", plural: "Quotes", title: "QUOTATION" },
  credit_note: { singular: "Credit note", plural: "Credit notes", title: "CREDIT NOTE" },
};

export function documentLabel(kind: DocumentKind): string {
  return LABELS[kind].singular;
}

export function documentLabelPlural(kind: DocumentKind): string {
  return LABELS[kind].plural;
}

/** Heading printed on the PDF. GST B2B invoices say "TAX INVOICE". */
export function documentTitle(kind: DocumentKind, taxInvoice: boolean): string {
  if (kind === "invoice" && taxInvoice) return "TAX INVOICE";
  return LABELS[kind].title;
}

const BASE_PATHS: Record<DocumentKind, string> = {
  invoice: "/dashboard/invoices",
  quote: "/dashboard/quotes",
  credit_note: "/dashboard/credit-notes",
};

export function documentBasePath(kind: DocumentKind): string {
  return BASE_PATHS[kind];
}

export function documentPath(kind: DocumentKind, id: string): string {
  return `${BASE_PATHS[kind]}/${id}`;
}

/** Label for the second date on the document: due date, validity date, or plain date. */
export function secondDateLabel(kind: DocumentKind): string {
  return kind === "quote" ? "Valid until" : kind === "credit_note" ? "Credit date" : "Due date";
}

/** Statuses that make sense for each kind, in display order (used by filters). */
export function documentStatuses(kind: DocumentKind): InvoiceStatus[] {
  switch (kind) {
    case "quote":
      return ["draft", "pending", "accepted", "declined", "expired", "converted", "cancelled"];
    case "credit_note":
      return ["draft", "pending", "cancelled"];
    default:
      return ["draft", "pending", "partially_paid", "paid", "overdue", "cancelled"];
  }
}

/** Human label for a status, worded for the document kind ("pending" is "Open" on a quote). */
export function statusLabel(status: InvoiceStatus, kind: DocumentKind = "invoice"): string {
  if (status === "pending") {
    if (kind === "quote") return "Open";
    if (kind === "credit_note") return "Issued";
    return "Pending";
  }
  const labels: Record<InvoiceStatus, string> = {
    draft: "Draft",
    pending: "Pending",
    partially_paid: "Partially paid",
    paid: "Paid",
    overdue: "Overdue",
    cancelled: "Cancelled",
    accepted: "Accepted",
    declined: "Declined",
    expired: "Expired",
    converted: "Converted",
  };
  return labels[status] ?? status;
}

/** Quote statuses from which the client can still respond. */
export const QUOTE_OPEN_STATUSES: InvoiceStatus[] = ["pending", "expired"];
/** Quote statuses from which it can be turned into an invoice. */
export const QUOTE_CONVERTIBLE_STATUSES: InvoiceStatus[] = ["pending", "accepted", "expired"];
