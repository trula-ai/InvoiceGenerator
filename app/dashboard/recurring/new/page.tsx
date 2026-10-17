import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { InstallmentPlanForm } from "@/components/installments/installment-plan-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { getInvoiceDetail, PAYABLE_STATUSES } from "@/lib/data/invoices";

export const metadata: Metadata = { title: "New installment plan" };

export default async function NewInstallmentPlanPage({ searchParams }: PageProps<"/dashboard/recurring/new">) {
  const { business } = await requireUser();
  const params = await searchParams;
  const invoiceId = typeof params.invoice === "string" ? params.invoice : undefined;
  if (!invoiceId) redirect("/dashboard/recurring");
  const detail = await getInvoiceDetail(business.id, invoiceId);
  if (!detail || detail.invoice.documentKind !== "invoice") notFound();
  if (detail.installments.length > 0) redirect(`/dashboard/recurring/${invoiceId}`);
  if (!PAYABLE_STATUSES.includes(detail.invoice.status)) redirect(`/dashboard/invoices/${invoiceId}`);
  const { invoice, client } = detail;

  return (
    <>
      <PageHeader title={`Split ${invoice.invoiceNumber} into installments`} description="Set up EMI-style repeated payments. Reminders, overdue status and online payment follow each installment's own due date." />
      <InstallmentPlanForm
        mode="create"
        invoiceId={invoice.id}
        invoice={{
          invoiceNumber: invoice.invoiceNumber,
          clientName: client.name,
          total: invoice.total,
          currency: invoice.currency,
          dueDate: invoice.dueDate,
          amountPaid: invoice.amountPaid,
          creditAmount: invoice.creditAmount,
        }}
      />
    </>
  );
}
