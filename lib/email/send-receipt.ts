import { render } from "@react-email/components";
import { createElement } from "react";

import { emailLogs } from "@/db/schema";
import { getPaymentDetail } from "@/lib/data/payments";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { isZero } from "@/lib/money";
import { pdfFileName, renderReceiptPdf } from "@/lib/pdf/render";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/payment";

import { getEmailProvider } from "./provider";
import { ReceiptEmail, receiptEmailText, type ReceiptEmailProps } from "./templates/receipt-email";
import { publicInvoiceUrl } from "./urls";

export interface SendReceiptOptions {
  to?: string;
  message?: string;
}

export interface SendReceiptResult {
  provider: string;
  to: string;
  messageId: string | null;
  invoiceId: string;
}

/**
 * Emails a payment receipt (PDF attached) to the client. Logged against the
 * invoice in `email_logs` so the invoice page shows every message sent.
 */
export async function sendReceiptEmail(businessId: string, paymentId: string, options: SendReceiptOptions = {}): Promise<SendReceiptResult> {
  const detail = await getPaymentDetail(businessId, paymentId);
  if (!detail) throw new Error("Payment not found.");
  const { payment, invoice, client, business } = detail;

  const to = (options.to ?? client.email ?? "").trim().toLowerCase();
  if (!to) throw new Error("The client has no email address. Add one to the client or enter a recipient.");

  const props: ReceiptEmailProps = {
    businessName: business.name,
    clientName: client.contactName || client.name,
    receiptNumber: payment.receiptNumber,
    invoiceNumber: invoice.invoiceNumber,
    paymentDate: formatDate(payment.paymentDate),
    method: PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
    reference: payment.reference,
    amountFormatted: formatCurrency(payment.amount, invoice.currency),
    balanceFormatted: formatCurrency(invoice.balanceDue, invoice.currency),
    settled: isZero(invoice.balanceDue),
    viewUrl: publicInvoiceUrl(invoice.publicToken),
    message: options.message,
  };

  const subject = `Payment receipt ${payment.receiptNumber} from ${business.name}`;
  const provider = getEmailProvider();
  const [pdf, html] = await Promise.all([renderReceiptPdf(detail), render(createElement(ReceiptEmail, props))]);

  try {
    const result = await provider.send({
      to,
      subject,
      html,
      text: receiptEmailText(props),
      replyTo: business.email ?? undefined,
      attachments: [{ filename: pdfFileName(payment.receiptNumber), content: pdf, contentType: "application/pdf" }],
    });
    await db.insert(emailLogs).values({
      businessId,
      invoiceId: invoice.id,
      toEmail: to,
      subject,
      status: "sent",
      provider: provider.name,
      providerMessageId: result.messageId,
    });
    return { provider: provider.name, to, messageId: result.messageId, invoiceId: invoice.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.insert(emailLogs).values({ businessId, invoiceId: invoice.id, toEmail: to, subject, status: "failed", provider: provider.name, error: message });
    throw new Error(`Email could not be sent: ${message}`);
  }
}
