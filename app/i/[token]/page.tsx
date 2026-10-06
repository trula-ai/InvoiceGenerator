import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Download, Receipt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { BASE_CURRENCY } from "@/lib/currency";
import { getInvoiceDetailByToken } from "@/lib/data/invoices";
import { formatCurrency, formatDate, formatRate } from "@/lib/format";
import { isZero } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/payment";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

/**
 * Public, read-only invoice page reached from the link in invoice emails.
 * Anyone holding the token can view and download the PDF; nothing can be
 * changed from here and no other data is reachable.
 */
export default async function PublicInvoicePage({ params }: PageProps<"/i/[token]">) {
  const { token } = await params;
  const detail = await getInvoiceDetailByToken(token);
  if (!detail) notFound();

  const { invoice, client, business, items, payments } = detail;
  const cur = invoice.currency;
  const showGst = invoice.gstApplied;
  const title = invoice.invoiceType === "b2b" && showGst ? "Tax invoice" : "Invoice";
  const businessAddress = compact([business.addressLine1, business.addressLine2, [business.city, business.state, business.postalCode].filter(Boolean).join(", "), business.country]);
  const clientAddress = compact([client.addressLine1, client.addressLine2, [client.city, client.state, client.postalCode].filter(Boolean).join(", "), client.country]);
  const settled = invoice.status === "paid";

  return (
    <main className="min-h-dvh bg-muted/40 px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            {business.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={business.logoDataUrl} alt={`${business.name} logo`} className="size-12 rounded-lg object-contain ring-1 ring-foreground/10" />
            ) : (
              <span className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Receipt className="size-6" />
              </span>
            )}
            <div>
              <p className="text-lg font-semibold tracking-tight">{business.name}</p>
              {business.email ? <p className="text-sm text-muted-foreground">{business.email}</p> : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" nativeButton={false} render={<a href={`/api/public/invoices/${token}/pdf`} target="_blank" rel="noreferrer" />}>
              View PDF
            </Button>
            <Button nativeButton={false} render={<a href={`/api/public/invoices/${token}/pdf?download=1`} />}>
              <Download /> Download
            </Button>
          </div>
        </header>

        <Card className="shadow-neu">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
                <CardTitle className="font-mono text-2xl">{invoice.invoiceNumber}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={invoice.status} />
                <Badge variant="secondary" className="uppercase">
                  {invoice.invoiceType}
                </Badge>
              </div>
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Meta label="Issued" value={formatDate(invoice.issueDate)} />
              <Meta label="Due" value={formatDate(invoice.dueDate)} />
              <Meta label="Currency" value={cur !== BASE_CURRENCY ? `${cur} · 1 ${cur} = ${formatRate(invoice.exchangeRate)} ${BASE_CURRENCY}` : cur} />
            </dl>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <Party title="From" name={business.name} lines={[...businessAddress, business.phone ?? ""]} gstin={showGst ? business.gstin : null} />
              <Party title="Bill to" name={client.name} lines={[client.contactName ?? "", ...clientAddress, client.email ?? ""]} gstin={showGst ? invoice.clientGstin : null} />
            </div>

            <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    {showGst ? <TableHead className="hidden sm:table-cell">HSN/SAC</TableHead> : null}
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Rate</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Tax %</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-pre-line">{item.description}</TableCell>
                      {showGst ? <TableCell className="hidden font-mono text-xs sm:table-cell">{item.hsnSac ?? "—"}</TableCell> : null}
                      <TableCell className="text-right tabular-nums">
                        {Number(item.quantity).toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                        {item.unit ? ` ${item.unit}` : ""}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatCurrency(item.unitPrice, cur)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{Number(item.taxRate).toFixed(2)}%</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(item.lineSubtotal, cur)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="ml-auto flex w-full max-w-xs flex-col gap-1.5 text-sm tabular-nums">
              <Line label="Subtotal" value={formatCurrency(invoice.subtotal, cur)} />
              {!isZero(invoice.discountAmount) ? (
                <>
                  <Line label={`Discount${invoice.discountType === "percent" ? ` (${Number(invoice.discountValue).toFixed(2)}%)` : ""}`} value={`- ${formatCurrency(invoice.discountAmount, cur)}`} />
                  <Line label="Taxable amount" value={formatCurrency(invoice.taxableAmount, cur)} />
                </>
              ) : null}
              {showGst ? (
                invoice.isInterState ? (
                  <Line label="IGST" value={formatCurrency(invoice.igstAmount, cur)} />
                ) : (
                  <>
                    <Line label="CGST" value={formatCurrency(invoice.cgstAmount, cur)} />
                    <Line label="SGST" value={formatCurrency(invoice.sgstAmount, cur)} />
                  </>
                )
              ) : !isZero(invoice.taxAmount) ? (
                <Line label="Tax" value={formatCurrency(invoice.taxAmount, cur)} />
              ) : null}
              <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatCurrency(invoice.total, cur)}</span>
              </div>
              {!isZero(invoice.amountPaid) ? <Line label="Paid" value={formatCurrency(invoice.amountPaid, cur)} /> : null}
              <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-base font-semibold ${settled ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-primary/5"}`}>
                <span className="flex items-center gap-1.5">
                  {settled ? <CheckCircle2 className="size-4" /> : null}
                  {settled ? "Paid in full" : "Balance due"}
                </span>
                <span>{formatCurrency(invoice.balanceDue, cur)}</span>
              </div>
            </div>

            {payments.length > 0 ? (
              <div className="text-sm">
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Payments received</p>
                <ul className="divide-y rounded-lg ring-1 ring-foreground/10">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span>
                        <span className="font-medium">{p.receiptNumber}</span>
                        <span className="text-muted-foreground"> · {formatDate(p.paymentDate)} · {PAYMENT_METHOD_LABELS[p.method]}</span>
                      </span>
                      <span className="font-medium tabular-nums">{formatCurrency(p.amount, cur)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!settled && business.bankDetails ? (
              <div className="rounded-lg bg-muted/60 p-4 text-sm">
                <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">How to pay</p>
                <p className="whitespace-pre-line">{business.bankDetails}</p>
              </div>
            ) : null}

            {invoice.notes || invoice.terms ? (
              <div className="grid gap-4 border-t pt-4 text-sm sm:grid-cols-2">
                {invoice.notes ? (
                  <div>
                    <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Notes</p>
                    <p className="whitespace-pre-line">{invoice.notes}</p>
                  </div>
                ) : null}
                {invoice.terms ? (
                  <div>
                    <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Terms</p>
                    <p className="whitespace-pre-line">{invoice.terms}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Questions about this invoice? Reply to the email it arrived with{business.email ? ` or write to ${business.email}` : ""}.
        </p>
      </div>
    </main>
  );
}

function compact(values: (string | null | undefined)[]): string[] {
  return values.filter((v): v is string => !!v && v.trim() !== "");
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Party({ title, name, lines, gstin }: { title: string; name: string; lines: string[]; gstin?: string | null }) {
  return (
    <div className="text-sm">
      <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      <p className="font-medium">{name}</p>
      {lines.filter(Boolean).map((l, i) => (
        <p key={i} className="text-muted-foreground">
          {l}
        </p>
      ))}
      {gstin ? <p className="mt-1 font-mono text-xs">GSTIN {gstin}</p> : null}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
