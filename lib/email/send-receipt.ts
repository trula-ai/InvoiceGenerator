import { render } from "@react-email/components";
import { createElement } from "react";

import { emailLogs } from "@/db/schema";
import { getPaymentDetail } from "@/lib/data/payments";
import { getReceiptForPayment, loadReceiptRenderData, receiptRelease, recordReceiptDelivery, storeReceiptPdf } from "@/lib/data/receipts";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { isZero } from "@/lib/money";
import { pdfFileName, renderReceiptPdf } from "@/lib/pdf/render";

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
 * Returns the stored receipt PDF, rendering and storing it on first use so
 * every later download or resend serves the same bytes.
 */
export async function receiptPdfBytes(businessId: string, paymentId: string): Promise<{ pdf: Buffer; receiptNumber: string } | null> {
  const receipt = await getReceiptForPayment(businessId, paymentId);
  if (!receipt) return null;
  if (receipt.pdf) return { pdf: Buffer.from(receipt.pdf), receiptNumber: receipt.receiptNumber };
  const data = await loadReceiptRenderData(businessId, paymentId);
  if (!data) return null;
  const pdf = await renderReceiptPdf(data);
  await storeReceiptPdf(businessId, paymentId, pdf);
  return { pdf, receiptNumber: receipt.receiptNumber };
}

/**
 * Emails the payment receipt (frozen PDF attached) to the client. Refused
 * until the receipt is released (verified, not void, and the sales credit
 * approved when the business requires it). Logged in `email_logs` against the
 * invoice and on the receipt's delivery status, so a failed send is visible
 * and can be retried without touching the payment.
 */
export async function sendReceiptEmail(businessId: string, paymentId: string, options: SendReceiptOptions = {}): Promise<SendReceiptResult> {
  const detail = await getPaymentDetail(businessId, paymentId);
  if (!detail) throw new Error("Payment not found.");
  const { payment, invoice, client, business } = detail;
  const receipt = await getReceiptForPayment(businessId, paymentId);
  const release = await receiptRelease(business, payment, receipt);
  if (!release.released) throw new Error(release.reason);

  const to = (options.to ?? client.email ?? "").trim().toLowerCase();
  if (!to) throw new Error("The client has no email address. Add one to the client or enter a recipient.");

  const file = await receiptPdfBytes(businessId, paymentId);
  if (!file || !receipt) throw new Error("The receipt could not be prepared.");

  const props: ReceiptEmailProps = {
    businessName: business.name,
    clientName: client.contactName || client.name,
    receiptNumber: receipt.receiptNumber,
    invoiceNumber: receipt.invoiceNumber,
    paymentDate: formatDate(receipt.paymentDate),
    method: receipt.methodLabel,
    reference: receipt.reference,
    amountFormatted: formatCurrency(receipt.amount, receipt.currency),
    invoiceTotalFormatted: formatCurrency(receipt.invoiceTotal, receipt.currency),
    cumulativeFormatted: formatCurrency(receipt.cumulativePaid, receipt.currency),
    balanceFormatted: formatCurrency(receipt.balanceDue, receipt.currency),
    dueDate: formatDate(receipt.dueDate),
    settled: isZero(receipt.balanceDue),
    termsText: receipt.termsText,
    privacyUrl: receipt.privacyUrl,
    viewUrl: publicInvoiceUrl(invoice.publicToken),
    message: options.message,
  };

  const subject = `Payment receipt ${receipt.receiptNumber} from ${business.name}`;
  const provider = getEmailProvider();
  const html = await render(createElement(ReceiptEmail, props));

  try {
    const result = await provider.send({
      to,
      subject,
      html,
      text: receiptEmailText(props),
      replyTo: business.email ?? undefined,
      attachments: [{ filename: pdfFileName(receipt.receiptNumber), content: file.pdf, contentType: "application/pdf" }],
    });
    await db.insert(emailLogs).values({ businessId, invoiceId: invoice.id, toEmail: to, subject, status: "sent", provider: provider.name, providerMessageId: result.messageId });
    await recordReceiptDelivery(businessId, paymentId, { to });
    return { provider: provider.name, to, messageId: result.messageId, invoiceId: invoice.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.insert(emailLogs).values({ businessId, invoiceId: invoice.id, toEmail: to, subject, status: "failed", provider: provider.name, error: message });
    await recordReceiptDelivery(businessId, paymentId, { to, error: message });
    throw new Error(`Email could not be sent: ${message}`);
  }
}
