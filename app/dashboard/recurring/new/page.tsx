import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { RecurringForm } from "@/components/recurring/recurring-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { getInvoiceDetail } from "@/lib/data/invoices";
import { addMonthsIso } from "@/lib/recurring";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "New recurring schedule" };

export default async function NewRecurringPage({ searchParams }: PageProps<"/dashboard/recurring/new">) {
  const { business } = await requireUser();
  const params = await searchParams;
  const invoiceId = typeof params.invoice === "string" ? params.invoice : undefined;
  if (!invoiceId) redirect("/dashboard/recurring");
  const detail = await getInvoiceDetail(business.id, invoiceId);
  if (!detail || detail.invoice.documentKind !== "invoice") notFound();
  const { invoice, client, items } = detail;

  return (
    <>
      <PageHeader
        title={`Repeat ${invoice.invoiceNumber}`}
        description="Choose how often to bill these lines. Each run creates a new, numbered invoice dated on the run date with your usual payment terms."
      />
      <RecurringForm
        mode="create"
        invoiceId={invoice.id}
        defaultValues={{ name: `${client.name} · ${invoice.reference ?? "recurring"}`.slice(0, 120), startDate: addMonthsIso(invoice.issueDate, 1) }}
        summary={{ clientName: client.name, sourceInvoiceNumber: invoice.invoiceNumber, totalLabel: formatCurrency(invoice.total, invoice.currency), itemCount: items.length }}
      />
    </>
  );
}
