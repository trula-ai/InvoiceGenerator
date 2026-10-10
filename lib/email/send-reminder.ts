import { render } from "@react-email/components";
import { createElement } from "react";

import { eq } from "drizzle-orm";

import { emailLogs, invoices } from "@/db/schema";
import { getInvoiceDetail, PAYABLE_STATUSES } from "@/lib/data/invoices";
import { notifyInvoiceEvent } from "@/lib/data/notifications";
import { db } from "@/lib/db";
import { todayIso } from "@/lib/fiscal-year";
import { formatCurrency, formatDate } from "@/lib/format";
import { pdfFileName, renderInvoicePdf } from "@/lib/pdf/render";

import { getEmailProvider } from "./provider";
import type { SendInvoiceOptions, SendInvoiceResult } from "./send-invoice";
import { ReminderEmail, reminderEmailText, reminderSubject, type ReminderEmailProps } from "./templates/reminder-email";
import { publicInvoiceUrl } from "./urls";

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.UTC(Number(fromIso.slice(0, 4)), Number(fromIso.slice(5, 7)) - 1, Number(fromIso.slice(8, 10)));
  const to = Date.UTC(Number(toIso.slice(0, 4)), Number(toIso.slice(5, 7)) - 1, Number(toIso.slice(8, 10)));
  return Math.round((to - from) / 86_400_000);
}

/**
 * Sends a payment reminder for an unpaid invoice with the PDF attached.
 * Allowed for pending, partially paid and overdue invoices only.
 */
export async function sendReminderEmail(businessId: string, invoiceId: string, options: SendInvoiceOptions = {}): Promise<SendInvoiceResult> {
  const detail = await getInvoiceDetail(businessId, invoiceId);
  if (!detail) throw new Error("Invoice not found.");
  const { invoice, client, business } = detail;

  if (invoice.documentKind !== "invoice" || !PAYABLE_STATUSES.includes(invoice.status)) {
    throw new Error("Reminders can only be sent for invoices that are awaiting payment.");
  }
  const to = (options.to ?? client.email ?? "").trim().toLowerCase();
  if (!to) throw new Error("The client has no email address. Add one to the client or enter a recipient.");

  const props: ReminderEmailProps = {
    businessName: business.name,
    clientName: client.contactName || client.name,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: formatDate(invoice.issueDate),
    dueDate: formatDate(invoice.dueDate),
    daysOverdue: daysBetween(invoice.dueDate, todayIso()),
    balanceFormatted: formatCurrency(invoice.balanceDue, invoice.currency),
    totalFormatted: formatCurrency(invoice.total, invoice.currency),
    viewUrl: publicInvoiceUrl(invoice.publicToken),
    message: options.message,
    bankDetails: business.bankDetails,
  };

  const subject = reminderSubject(props);
  const provider = getEmailProvider();
  const [pdf, html] = await Promise.all([renderInvoicePdf(detail), render(createElement(ReminderEmail, props))]);

  try {
    const result = await provider.send({
      to,
      subject,
      html,
      text: reminderEmailText(props),
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
    await db.update(invoices).set({ lastReminderAt: new Date() }).where(eq(invoices.id, invoiceId));
    await notifyInvoiceEvent(businessId, invoiceId, "reminder_sent", { to });
    return { provider: provider.name, to, messageId: result.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.insert(emailLogs).values({ businessId, invoiceId, toEmail: to, subject, status: "failed", provider: provider.name, error: message });
    await notifyInvoiceEvent(businessId, invoiceId, "reminder_failed", { to, error: message });
    throw new Error(`Email could not be sent: ${message}`);
  }
}
