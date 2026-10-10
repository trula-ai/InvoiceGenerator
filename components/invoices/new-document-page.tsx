import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InvoiceForm, type SourceDocument } from "@/components/invoices/invoice-form";
import { PageHeader } from "@/components/shared/page-header";
import type { DocumentKind } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { listClientOptions } from "@/lib/data/clients";
import { getRateToInr, type RateQuote } from "@/lib/data/exchange-rates";
import { getInvoiceDetail } from "@/lib/data/invoices";
import { listItemOptions } from "@/lib/data/items";
import { BASE_CURRENCY } from "@/lib/currency";
import { documentLabel, documentPath } from "@/lib/documents";
import { addDaysIso, todayIso } from "@/lib/fiscal-year";
import { D, toMoney } from "@/lib/money";
import type { InvoiceFormInput } from "@/lib/validation/invoice";

type SearchParams = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/**
 * Shared "new document" page. Invoices and quotes start blank (or duplicate
 * `?from=`), credit notes are seeded from the invoice in `?invoice=`.
 */
export async function NewDocumentPage({ kind, searchParams }: { kind: DocumentKind; searchParams: Promise<SearchParams> }) {
  const { business } = await requireUser();
  const params = await searchParams;
  const label = documentLabel(kind);

  // Credit notes copy the invoice they are issued against.
  const sourceInvoiceId = kind === "credit_note" ? str(params.invoice) : undefined;
  if (kind === "credit_note" && !sourceInvoiceId) redirect("/dashboard/credit-notes");
  const fromId = kind === "credit_note" ? sourceInvoiceId : str(params.from);

  const [clients, catalog, source] = await Promise.all([
    listClientOptions(business.id),
    listItemOptions(business.id),
    fromId ? getInvoiceDetail(business.id, fromId) : null,
  ]);
  if (kind === "credit_note") {
    if (!source || source.invoice.documentKind !== "invoice") notFound();
    if (source.invoice.status === "draft" || source.invoice.status === "cancelled") redirect(documentPath("invoice", source.invoice.id));
  }

  const initialClientId = source?.invoice.clientId ?? str(params.client);
  const initialClient = clients.find((c) => c.id === initialClientId);
  const initialCurrency = source?.invoice.currency ?? initialClient?.currency ?? business.defaultCurrency;

  // Pre-fetch the rate for the starting currency so the form opens ready to use.
  // Credit notes keep the invoice's frozen rate instead.
  let initialRate: RateQuote | null = null;
  if (kind !== "credit_note" && initialCurrency !== BASE_CURRENCY) {
    try {
      initialRate = await getRateToInr(initialCurrency);
    } catch {
      initialRate = null; // form falls back to manual entry
    }
  }

  const today = todayIso();
  const secondDate = kind === "quote" ? addDaysIso(today, business.quoteValidityDays) : kind === "credit_note" ? today : addDaysIso(today, business.paymentTermsDays);

  let sourceDocument: SourceDocument | null = null;
  if (kind === "credit_note" && source) {
    sourceDocument = {
      id: source.invoice.id,
      invoiceNumber: source.invoice.invoiceNumber,
      currency: source.invoice.currency,
      total: source.invoice.total,
      remainingCredit: toMoney(D(source.invoice.total).minus(D(source.invoice.creditAmount))),
    };
  }

  const seeded: InvoiceFormInput | undefined = source
    ? {
        clientId: source.invoice.clientId,
        invoiceType: source.invoice.invoiceType,
        issueDate: today,
        dueDate: secondDate,
        poNumber: kind === "credit_note" ? (source.invoice.poNumber ?? "") : "",
        reference: kind === "credit_note" ? `Credit against ${source.invoice.invoiceNumber}` : (source.invoice.reference ?? ""),
        shipToAddress: source.invoice.shipToAddress ?? "",
        currency: source.invoice.currency,
        exchangeRate:
          source.invoice.currency === BASE_CURRENCY ? "1" : kind === "credit_note" ? source.invoice.exchangeRate : (initialRate?.rate ?? source.invoice.exchangeRate),
        exchangeRateSource: source.invoice.currency === BASE_CURRENCY ? "base" : kind === "credit_note" ? "manual" : initialRate ? "api" : "manual",
        placeOfSupplyCode: source.invoice.placeOfSupplyCode ?? "",
        discountType: source.invoice.discountType,
        discountValue: source.invoice.discountType === "none" ? "" : source.invoice.discountValue,
        notes: kind === "credit_note" ? "" : (source.invoice.notes ?? ""),
        terms: kind === "credit_note" ? "" : (source.invoice.terms ?? ""),
        items: source.items.map((i) => ({
          itemId: i.itemId ?? "",
          description: i.description,
          hsnSac: i.hsnSac ?? "",
          quantity: String(Number(i.quantity)),
          unit: i.unit ?? "",
          unitPrice: i.unitPrice,
          taxRate: String(Number(i.taxRate)),
        })),
        status: "pending",
      }
    : undefined;

  const title =
    kind === "credit_note" && source
      ? `Credit note for ${source.invoice.invoiceNumber}`
      : source
        ? `Duplicate of ${source.invoice.invoiceNumber}`
        : `New ${label.toLowerCase()}`;
  const description =
    kind === "credit_note"
      ? "Lines are copied from the invoice. Remove or reduce them to credit only part of it; the balance of the invoice is reduced when the credit note is issued."
      : source
        ? "Client, items and notes are copied. A new number, today's date and a fresh exchange rate are applied."
        : kind === "quote"
          ? `Quotes get their own number series and expire after ${business.quoteValidityDays} days unless you change the validity date.`
          : business.gstEnabled
            ? "GST is enabled: tax will be split into CGST/SGST or IGST."
            : "GST is disabled: a flat tax rate is applied per item.";

  return (
    <>
      <PageHeader title={title} description={description} />
      {business.gstEnabled && !business.stateCode ? (
        <Alert variant="destructive">
          <AlertTitle>Business state not set</AlertTitle>
          <AlertDescription>
            GST is enabled but your business state is missing, so every supply would be treated as inter-state.{" "}
            <Link href="/dashboard/settings" className="underline">
              Set it in Settings
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}
      <InvoiceForm
        mode="create"
        kind={kind}
        sourceDocument={sourceDocument}
        clients={clients}
        catalog={catalog}
        initialClientId={initialClientId}
        initialRate={initialRate}
        defaultValues={seeded}
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
      />
    </>
  );
}
