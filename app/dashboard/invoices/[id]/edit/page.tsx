import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { InvoiceForm } from "@/components/invoices/invoice-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { listClientOptions } from "@/lib/data/clients";
import { getInvoiceDetail, isInvoiceEditable } from "@/lib/data/invoices";
import { listItemOptions } from "@/lib/data/items";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: PageProps<"/dashboard/invoices/[id]/edit">) {
  const { business } = await requireUser();
  const { id } = await params;
  const [detail, clients, catalog] = await Promise.all([getInvoiceDetail(business.id, id), listClientOptions(business.id), listItemOptions(business.id)]);
  if (!detail) notFound();
  if (!isInvoiceEditable(detail.invoice)) redirect(`/dashboard/invoices/${id}`);

  const { invoice, items } = detail;

  return (
    <>
      <PageHeader title={`Edit ${invoice.invoiceNumber}`} description="The invoice number is kept; totals are recalculated from the items below." />
      <InvoiceForm
        mode="edit"
        invoiceId={invoice.id}
        currentStatus={invoice.status}
        clients={clients}
        catalog={catalog}
        business={{
          gstEnabled: business.gstEnabled,
          stateCode: business.stateCode,
          defaultCurrency: business.defaultCurrency,
          paymentTermsDays: business.paymentTermsDays,
          invoiceNotes: business.invoiceNotes,
          invoiceTerms: business.invoiceTerms,
          roundTotals: business.roundTotals,
        }}
        defaultValues={{
          clientId: invoice.clientId,
          invoiceType: invoice.invoiceType,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          poNumber: invoice.poNumber ?? "",
          reference: invoice.reference ?? "",
          shipToAddress: invoice.shipToAddress ?? "",
          currency: invoice.currency,
          exchangeRate: invoice.exchangeRate,
          exchangeRateSource: invoice.exchangeRateSource,
          placeOfSupplyCode: invoice.placeOfSupplyCode ?? "",
          discountType: invoice.discountType,
          discountValue: invoice.discountType === "none" ? "" : invoice.discountValue,
          notes: invoice.notes ?? "",
          terms: invoice.terms ?? "",
          items: items.map((i) => ({
            itemId: i.itemId ?? "",
            description: i.description,
            hsnSac: i.hsnSac ?? "",
            quantity: String(Number(i.quantity)),
            unit: i.unit ?? "",
            unitPrice: i.unitPrice,
            taxRate: String(Number(i.taxRate)),
          })),
          status: invoice.status === "draft" ? "draft" : "pending",
        }}
      />
    </>
  );
}
