import { render } from "@react-email/components";
import { createElement } from "react";

import { emailLogs } from "@/db/schema";
import { getInvoiceDetail, markInvoiceSent } from "@/lib/data/invoices";
import { notifyInvoiceEvent } from "@/lib/data/notifications";
import { db } from "@/lib/db";
import { documentLabel } from "@/lib/documents";
import { formatCurrency, formatDate } from "@/lib/format";
import { pdfFileName, renderInvoicePdf } from "@/lib/pdf/render";

import { getEmailProvider } from "./provider";
import { publicInvoiceUrl } from "./urls";
import { InvoiceEmail, invoiceEmailText, type InvoiceEmailProps } from "./templates/invoice-email";

export interface SendInvoiceOptions {
  /** Override recipient; defaults to the client's email. */
  to?: string;
  /** Optional personal message inserted into the email body. */
  message?: string;
}

export interface SendInvoiceResult {
  provider: string;
  to: string;
  messageId: string | null;
}

/**
 * Generates the invoice PDF, renders the email, sends it through the configured
 * provider, records the attempt in `email_logs` and marks the invoice as sent.
 */
export async function sendInvoiceEmail(
  businessId: string,
  invoiceId: string,
  options: SendInvoiceOptions = {},
): Promise<SendInvoiceResult> {
  const detail = await getInvoiceDetail(businessId, invoiceId);
  if (!detail) throw new Error("Invoice not found.");
  const { invoice, client, business } = detail;

  const to = (options.to ?? client.email ?? "").trim().toLowerCase();
  if (!to) throw new Error("The client has no email address. Add one to the client or enter a recipient.");
  const kind = invoice.documentKind;
  const label = documentLabel(kind);
  if (invoice.status === "cancelled") throw new Error(`Cancelled ${label.toLowerCase()}s cannot be sent.`);

  const props: InvoiceEmailProps = {
    kind,
    businessName: business.name,
    clientName: client.contactName || client.name,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: formatDate(invoice.issueDate),
    dueDate: formatDate(invoice.dueDate),
    totalFormatted: formatCurrency(invoice.total, invoice.currency),
    balanceFormatted: formatCurrency(invoice.balanceDue, invoice.currency),
    sourceNumber: detail.source?.invoiceNumber ?? null,
    viewUrl: publicInvoiceUrl(invoice.publicToken),
    message: options.message,
    bankDetails: kind === "invoice" ? business.bankDetails : null,
  };

  const subject = `${label} ${invoice.invoiceNumber} from ${business.name}`;
  const provider = getEmailProvider();

  const [pdf, html] = await Promise.all([renderInvoicePdf(detail), render(createElement(InvoiceEmail, props))]);

  try {
    const result = await provider.send({
      to,
      subject,
      html,
      text: invoiceEmailText(props),
      replyTo: business.email ?? undefined,
      attachments: [{ filename: pdfFileName(invoice.invoiceNumber), content: pdf, contentType: "application/pdf" }],
    });

    await db.insert(emailLogs).values({
      businessId,
      invoiceId,
      toEmail: to,
      subject,
      status: "sent",
      provider: provider.name,
      providerMessageId: result.messageId,
    });
    await markInvoiceSent(businessId, invoiceId);
    await notifyInvoiceEvent(businessId, invoiceId, "invoice_sent", { to });

    return { provider: provider.name, to, messageId: result.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.insert(emailLogs).values({
      businessId,
      invoiceId,
      toEmail: to,
      subject,
      status: "failed",
      provider: provider.name,
      error: message,
    });
    throw new Error(`Email could not be sent: ${message}`);
  }
}
