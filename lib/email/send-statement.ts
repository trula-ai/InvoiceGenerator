import { render } from "@react-email/components";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { createElement } from "react";

import { businesses, clients, emailLogs, invoices } from "@/db/schema";
import { getInvoiceDetail, PAYABLE_STATUSES } from "@/lib/data/invoices";
import { createNotification, daysBetweenIso } from "@/lib/data/notifications";
import { db } from "@/lib/db";
import { todayIso } from "@/lib/fiscal-year";
import { formatCurrency, formatDate } from "@/lib/format";
import { D, toMoney } from "@/lib/money";
import { pdfFileName, renderInvoicePdf } from "@/lib/pdf/render";

import { getEmailProvider } from "./provider";
import { StatementEmail, statementEmailText, statementSubject, type StatementEmailProps, type StatementInvoiceRow } from "./templates/statement-email";
import { publicInvoiceUrl } from "./urls";

/** PDFs attached to a statement; beyond this the email links to the invoices instead. */
const MAX_ATTACHMENTS = 10;

export interface SendStatementOptions {
  to?: string;
  message?: string;
}

export interface SendStatementResult {
  provider: string;
  to: string;
  messageId: string | null;
  clientId: string;
  invoiceCount: number;
}

function statusLabel(dueDate: string, today: string): { label: string; overdue: boolean } {
  const days = daysBetweenIso(today, dueDate);
  if (days === 0) return { label: "Due today", overdue: false };
  if (days > 0) return { label: `Due in ${days} day${days === 1 ? "" : "s"}`, overdue: false };
  return { label: `${-days} day${days === -1 ? "" : "s"} overdue`, overdue: true };
}

/**
 * Emails a client one statement listing every invoice that still has a
 * balance, with the PDFs attached. Logged against each included invoice and
 * recorded as the invoices' last reminder.
 */
export async function sendClientStatementEmail(businessId: string, clientId: string, options: SendStatementOptions = {}): Promise<SendStatementResult> {
  const [row] = await db
    .select({ client: clients, business: businesses })
    .from(clients)
    .innerJoin(businesses, eq(businesses.id, clients.businessId))
    .where(and(eq(clients.businessId, businessId), eq(clients.id, clientId)))
    .limit(1);
  if (!row) throw new Error("Client not found.");
  const { client, business } = row;

  const outstanding = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.businessId, businessId),
        eq(invoices.documentKind, "invoice"),
        eq(invoices.clientId, clientId),
        inArray(invoices.status, PAYABLE_STATUSES),
        sql`${invoices.balanceDue} > 0`,
      ),
    )
    .orderBy(asc(invoices.dueDate), asc(invoices.issueDate));
  if (!outstanding.length) throw new Error("This client has no outstanding invoices.");

  const to = (options.to ?? client.email ?? "").trim().toLowerCase();
  if (!to) throw new Error("The client has no email address. Add one to the client or enter a recipient.");

  const today = todayIso();
  const totals = new Map<string, ReturnType<typeof D>>();
  const rows: StatementInvoiceRow[] = outstanding.map((inv) => {
    totals.set(inv.currency, (totals.get(inv.currency) ?? D(0)).plus(D(inv.balanceDue)));
    const { label, overdue } = statusLabel(inv.dueDate, today);
    return {
      invoiceNumber: inv.invoiceNumber,
      issueDate: formatDate(inv.issueDate),
      dueDate: formatDate(inv.dueDate),
      totalFormatted: formatCurrency(inv.total, inv.currency),
      balanceFormatted: formatCurrency(inv.balanceDue, inv.currency),
      statusLabel: label,
      overdue,
      viewUrl: publicInvoiceUrl(inv.publicToken),
    };
  });

  const props: StatementEmailProps = {
    businessName: business.name,
    clientName: client.contactName || client.name,
    invoices: rows,
    totals: [...totals.entries()].map(([currency, amount]) => formatCurrency(toMoney(amount), currency)),
    message: options.message,
    bankDetails: business.bankDetails,
  };
  const subject = statementSubject(props);
  const provider = getEmailProvider();

  const details = await Promise.all(outstanding.slice(0, MAX_ATTACHMENTS).map((inv) => getInvoiceDetail(businessId, inv.id)));
  const [html, ...pdfs] = await Promise.all([
    render(createElement(StatementEmail, props)),
    ...details.filter((d) => d !== null).map((d) => renderInvoicePdf(d)),
  ]);
  const attachments = details
    .filter((d) => d !== null)
    .map((d, i) => ({ filename: pdfFileName(d.invoice.invoiceNumber), content: pdfs[i], contentType: "application/pdf" }));

  const log = (status: "sent" | "failed", extra: { providerMessageId?: string | null; error?: string }) =>
    db.insert(emailLogs).values(
      outstanding.map((inv) => ({
        businessId,
        invoiceId: inv.id,
        toEmail: to,
        subject,
        status,
        provider: provider.name,
        providerMessageId: extra.providerMessageId ?? null,
        error: extra.error ?? null,
      })),
    );

  try {
    const result = await provider.send({
      to,
      subject,
      html,
      text: statementEmailText(props),
      replyTo: business.email ?? undefined,
      attachments,
    });
    await log("sent", { providerMessageId: result.messageId });
    await db
      .update(invoices)
      .set({ lastReminderAt: new Date() })
      .where(
        inArray(
          invoices.id,
          outstanding.map((inv) => inv.id),
        ),
      );
    await createNotification(businessId, {
      kind: "statement_sent",
      title: `Statement sent to ${client.name}`,
      body: `${outstanding.length} outstanding invoice${outstanding.length === 1 ? "" : "s"} totalling ${props.totals.join(" + ")} emailed to ${to}.`,
      clientName: client.name,
      href: `/dashboard/clients/${client.id}`,
    });
    return { provider: provider.name, to, messageId: result.messageId, clientId: client.id, invoiceCount: outstanding.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await log("failed", { error: message });
    throw new Error(`Email could not be sent: ${message}`);
  }
}
