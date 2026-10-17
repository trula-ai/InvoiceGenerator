import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { InstallmentPlanForm } from "@/components/installments/installment-plan-form";
import { RemovePlanButton } from "@/components/installments/remove-plan-button";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { getInvoiceDetail } from "@/lib/data/invoices";

export const metadata: Metadata = { title: "Edit installment plan" };

/** `id` is the invoice id: a plan has no identity of its own. */
export default async function EditInstallmentPlanPage({ params }: PageProps<"/dashboard/recurring/[id]">) {
  const { business } = await requireUser();
  const { id } = await params;
  const detail = await getInvoiceDetail(business.id, id);
  if (!detail || detail.invoice.documentKind !== "invoice") notFound();
  if (detail.installments.length === 0) redirect(`/dashboard/recurring/new?invoice=${id}`);
  const { invoice, client, installments } = detail;

  return (
    <>
      <PageHeader title={`Installment plan for ${invoice.invoiceNumber}`} description="Change dates or amounts. Installments that are already paid keep their money; the plan still has to add up to the invoice total.">
        <RemovePlanButton invoiceId={invoice.id} size="default" />
      </PageHeader>
      <InstallmentPlanForm
        mode="edit"
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
        initialRows={installments.map((i) => ({ dueDate: i.dueDate, amount: i.amount }))}
      />
    </>
  );
}
