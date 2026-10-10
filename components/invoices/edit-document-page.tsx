import { notFound, redirect } from "next/navigation";

import { InvoiceForm, type SourceDocument } from "@/components/invoices/invoice-form";
import { PageHeader } from "@/components/shared/page-header";
import type { DocumentKind } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { listClientOptions } from "@/lib/data/clients";
import { getInvoiceDetail, isInvoiceEditable } from "@/lib/data/invoices";
import { listItemOptions } from "@/lib/data/items";
import { documentLabel, documentPath } from "@/lib/documents";
import { D, toMoney } from "@/lib/money";

/** Shared edit page for invoices, quotes and credit notes. */
export async function EditDocumentPage({ kind, id }: { kind: DocumentKind; id: string }) {
  const { business } = await requireUser();
  const [detail, clients, catalog] = await Promise.all([getInvoiceDetail(business.id, id), listClientOptions(business.id), listItemOptions(business.id)]);
  if (!detail) notFound();
  if (detail.invoice.documentKind !== kind) redirect(`${documentPath(detail.invoice.documentKind, id)}/edit`);
  if (!isInvoiceEditable(detail.invoice)) redirect(documentPath(kind, id));

  const { invoice, items, source } = detail;

  let sourceDocument: SourceDocument | null = null;
  if (kind === "credit_note" && source) {
    const [sourceDetail] = await Promise.all([getInvoiceDetail(business.id, source.id)]);
    const applied = sourceDetail ? D(sourceDetail.invoice.creditAmount) : D(0);
    // Exclude this credit note's own contribution when it is already issued.
    const own = invoice.status === "pending" ? D(invoice.total) : D(0);
    sourceDocument = {
      id: source.id,
      invoiceNumber: source.invoiceNumber,
      currency: source.currency,
      total: source.total,
      remainingCredit: toMoney(D(source.total).minus(applied).plus(own)),
    };
  }

  return (
    <>
      <PageHeader
        title={`Edit ${invoice.invoiceNumber}`}
        description={`The ${documentLabel(kind).toLowerCase()} number is kept; totals are recalculated from the items below.`}
      />
      <InvoiceForm
        mode="edit"
        kind={kind}
        sourceDocument={sourceDocument}
        invoiceId={invoice.id}
        currentStatus={invoice.status}
        clients={clients}
        catalog={catalog}
        business={{
          gstEnabled: business.gstEnabled,
          stateCode: business.stateCode,
          defaultCurrency: business.defaultCurrency,
          paymentTermsDays: business.paymentTermsDays,
          quoteValidityDays: business.quoteValidityDays,
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
