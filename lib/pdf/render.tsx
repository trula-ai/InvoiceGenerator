import { renderToBuffer } from "@react-pdf/renderer";

import type { InvoiceDetail } from "@/lib/data/invoices";
import type { PaymentDetail } from "@/lib/data/payments";

import { InvoiceDocument } from "./invoice-document";
import { ReceiptDocument } from "./receipt-document";

/**
 * Server-side PDF rendering. These run in Route Handlers and Server Actions
 * only; @react-pdf/renderer is marked as a server external package in
 * next.config.ts.
 */

export async function renderInvoicePdf(detail: InvoiceDetail): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument detail={detail} />);
}

export async function renderReceiptPdf(detail: PaymentDetail): Promise<Buffer> {
  return renderToBuffer(<ReceiptDocument detail={detail} />);
}

/** Safe file name for a document number like INV/2026-27/0001. */
export function pdfFileName(documentNumber: string): string {
  return `${documentNumber.replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`;
}
