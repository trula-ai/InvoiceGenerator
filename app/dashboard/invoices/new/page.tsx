import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { listClientOptions } from "@/lib/data/clients";
import { getRateToInr, type RateQuote } from "@/lib/data/exchange-rates";
import { getInvoiceDetail } from "@/lib/data/invoices";
import { listItemOptions } from "@/lib/data/items";
import { BASE_CURRENCY } from "@/lib/currency";
import { addDaysIso, todayIso } from "@/lib/fiscal-year";
import type { InvoiceFormInput } from "@/lib/validation/invoice";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/dashboard/invoices/new">) {
  const { business } = await requireUser();
  const params = await searchParams;
  const fromId = typeof params.from === "string" ? params.from : undefined;
  const [clients, catalog, source] = await Promise.all([
    listClientOptions(business.id),
    listItemOptions(business.id),
    fromId ? getInvoiceDetail(business.id, fromId) : null,
  ]);
  const initialClientId = source?.invoice.clientId ?? (typeof params.client === "string" ? params.client : undefined);
  const initialClient = clients.find((c) => c.id === initialClientId);
  const initialCurrency = source?.invoice.currency ?? initialClient?.currency ?? business.defaultCurrency;

  // Pre-fetch the rate for the starting currency so the form opens ready to use.
  let initialRate: RateQuote | null = null;
  if (initialCurrency !== BASE_CURRENCY) {
    try {
      initialRate = await getRateToInr(initialCurrency);
    } catch {
      initialRate = null; // form falls back to manual entry
    }
  }

  // Duplicate: same client, items, discount and notes; fresh dates, number and rate.
  const today = todayIso();
  const duplicateValues: InvoiceFormInput | undefined = source
    ? {
        clientId: source.invoice.clientId,
        invoiceType: source.invoice.invoiceType,
        issueDate: today,
        dueDate: addDaysIso(today, business.paymentTermsDays),
        poNumber: "",
        reference: source.invoice.reference ?? "",
        shipToAddress: source.invoice.shipToAddress ?? "",
        currency: source.invoice.currency,
        exchangeRate: source.invoice.currency === BASE_CURRENCY ? "1" : (initialRate?.rate ?? source.invoice.exchangeRate),
        exchangeRateSource: source.invoice.currency === BASE_CURRENCY ? "base" : initialRate ? "api" : "manual",
        placeOfSupplyCode: source.invoice.placeOfSupplyCode ?? "",
        discountType: source.invoice.discountType,
        discountValue: source.invoice.discountType === "none" ? "" : source.invoice.discountValue,
        notes: source.invoice.notes ?? "",
        terms: source.invoice.terms ?? "",
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

  return (
    <>
      <PageHeader
        title={source ? `Duplicate of ${source.invoice.invoiceNumber}` : "New invoice"}
        description={
          source
            ? "Client, items and notes are copied. A new number, today's date and a fresh exchange rate are applied."
            : business.gstEnabled
              ? "GST is enabled: tax will be split into CGST/SGST or IGST."
              : "GST is disabled: a flat tax rate is applied per item."
        }
      />
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
        clients={clients}
        catalog={catalog}
        initialClientId={initialClientId}
        initialRate={initialRate}
        defaultValues={duplicateValues}
        business={{
          gstEnabled: business.gstEnabled,
          stateCode: business.stateCode,
          defaultCurrency: business.defaultCurrency,
          paymentTermsDays: business.paymentTermsDays,
          invoiceNotes: business.invoiceNotes,
          invoiceTerms: business.invoiceTerms,
          roundTotals: business.roundTotals,
        }}
      />
    </>
  );
}
