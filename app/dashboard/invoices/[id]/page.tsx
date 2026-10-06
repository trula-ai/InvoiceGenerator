import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Mail } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { DeletePaymentButton } from "@/components/payments/delete-payment-button";
import { EmailReceiptButton } from "@/components/payments/email-receipt-button";
import { requireUser } from "@/lib/auth/current-user";
import { BASE_CURRENCY } from "@/lib/currency";
import { getInvoiceDetail, isInvoiceEditable } from "@/lib/data/invoices";
import { isEmailConfigured } from "@/lib/email/provider";
import { formatCurrency, formatDate, formatDateTime, formatRate } from "@/lib/format";
import { isZero } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/payment";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({ params }: PageProps<"/dashboard/invoices/[id]">) {
  const { business } = await requireUser();
  const { id } = await params;
  const detail = await getInvoiceDetail(business.id, id);
  if (!detail) notFound();

  const { invoice, client, items, payments, emails } = detail;
  const cur = invoice.currency;
  const showGst = invoice.gstApplied;
  const clientAddress = [client.addressLine1, client.addressLine2, [client.city, client.state, client.postalCode].filter(Boolean).join(", "), client.country].filter(Boolean);

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoiceNumber}</h1>
              <StatusBadge status={invoice.status} />
              <Badge variant="secondary" className="uppercase">
                {invoice.invoiceType}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Issued {formatDate(invoice.issueDate)} · Due {formatDate(invoice.dueDate)} · FY {invoice.financialYear}
              {invoice.sentAt ? ` · Sent ${formatDateTime(invoice.sentAt)}` : ""}
            </p>
          </div>
          <InvoiceActions
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoiceNumber}
            status={invoice.status}
            currency={cur}
            balanceDue={invoice.balanceDue}
            hasPayments={payments.length > 0}
            editable={isInvoiceEditable(invoice)}
            clientEmail={client.email}
            emailConfigured={isEmailConfigured()}
            publicToken={invoice.publicToken}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Bill to</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Link href={`/dashboard/clients/${client.id}`} className="font-medium hover:underline">
              {client.name}
            </Link>
            {client.contactName ? <p className="text-muted-foreground">{client.contactName}</p> : null}
            {clientAddress.map((l, i) => (
              <p key={i} className="text-muted-foreground">
                {l}
              </p>
            ))}
            {client.email ? <p className="text-muted-foreground">{client.email}</p> : null}
            {showGst && invoice.clientGstin ? <p className="mt-2 font-mono text-xs">GSTIN {invoice.clientGstin}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax & currency</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Meta label="Currency" value={cur} />
            {cur !== BASE_CURRENCY ? (
              <Meta label="Exchange rate" value={`1 ${cur} = ${formatRate(invoice.exchangeRate)} ${BASE_CURRENCY} (${invoice.exchangeRateSource})`} />
            ) : null}
            <Meta label="GST" value={showGst ? (invoice.isInterState ? "Inter-state · IGST" : "Intra-state · CGST + SGST") : "Not applied"} />
            {showGst && invoice.placeOfSupply ? <Meta label="Place of supply" value={`${invoice.placeOfSupply} (${invoice.placeOfSupplyCode})`} /> : null}
            {showGst && invoice.businessGstin ? <Meta label="Your GSTIN" value={invoice.businessGstin} mono /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Balance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm tabular-nums">
            <Meta label="Total" value={formatCurrency(invoice.total, cur)} />
            <Meta label="Paid" value={formatCurrency(invoice.amountPaid, cur)} />
            <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
              <span>Balance due</span>
              <span className={!isZero(invoice.balanceDue) && invoice.status === "overdue" ? "text-destructive" : ""}>{formatCurrency(invoice.balanceDue, cur)}</span>
            </div>
            {cur !== BASE_CURRENCY ? <Meta label={`Total in ${BASE_CURRENCY}`} value={formatCurrency(invoice.totalInr, BASE_CURRENCY)} muted /> : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Description</TableHead>
                {showGst ? <TableHead className="hidden md:table-cell">HSN/SAC</TableHead> : null}
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Rate</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Tax %</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="whitespace-pre-line">{item.description}</TableCell>
                  {showGst ? <TableCell className="hidden font-mono text-xs md:table-cell">{item.hsnSac ?? "—"}</TableCell> : null}
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

          <div className="mt-4 ml-auto flex w-full max-w-xs flex-col gap-1.5 text-sm tabular-nums">
            <Meta label="Subtotal" value={formatCurrency(invoice.subtotal, cur)} />
            {!isZero(invoice.discountAmount) ? (
              <>
                <Meta label={`Discount${invoice.discountType === "percent" ? ` (${Number(invoice.discountValue).toFixed(2)}%)` : ""}`} value={`- ${formatCurrency(invoice.discountAmount, cur)}`} />
                <Meta label="Taxable amount" value={formatCurrency(invoice.taxableAmount, cur)} />
              </>
            ) : null}
            {showGst ? (
              invoice.isInterState ? (
                <Meta label="IGST" value={formatCurrency(invoice.igstAmount, cur)} />
              ) : (
                <>
                  <Meta label="CGST" value={formatCurrency(invoice.cgstAmount, cur)} />
                  <Meta label="SGST" value={formatCurrency(invoice.sgstAmount, cur)} />
                </>
              )
            ) : !isZero(invoice.taxAmount) ? (
              <Meta label="Tax" value={formatCurrency(invoice.taxAmount, cur)} />
            ) : null}
            <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(invoice.total, cur)}</span>
            </div>
          </div>

          {invoice.notes || invoice.terms ? (
            <div className="mt-6 grid gap-4 border-t pt-4 text-sm sm:grid-cols-2">
              {invoice.notes ? (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Notes</p>
                  <p className="whitespace-pre-line">{invoice.notes}</p>
                </div>
              ) : null}
              {invoice.terms ? (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Terms</p>
                  <p className="whitespace-pre-line">{invoice.terms}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
            <CardDescription>{payments.length === 0 ? "No payments recorded yet." : `${payments.length} payment${payments.length === 1 ? "" : "s"} received.`}</CardDescription>
          </CardHeader>
          {payments.length > 0 ? (
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-28 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.receiptNumber}
                        {p.reference ? <span className="block text-xs font-normal text-muted-foreground">{p.reference}</span> : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(p.paymentDate)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{PAYMENT_METHOD_LABELS[p.method]}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(p.amount, cur)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" aria-label="Download receipt" nativeButton={false} render={<a href={`/api/payments/${p.id}/receipt?download=1`} />}>
                            <Download />
                          </Button>
                          <EmailReceiptButton compact paymentId={p.id} receiptNumber={p.receiptNumber} clientEmail={client.email} emailConfigured={isEmailConfigured()} />
                          <DeletePaymentButton paymentId={p.id} invoiceId={invoice.id} receiptNumber={p.receiptNumber} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          ) : null}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email history</CardTitle>
            <CardDescription>{emails.length === 0 ? "This invoice has not been emailed." : `${emails.length} attempt${emails.length === 1 ? "" : "s"}.`}</CardDescription>
          </CardHeader>
          {emails.length > 0 ? (
            <CardContent>
              <ul className="divide-y text-sm">
                {emails.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                    <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        To <span className="font-medium">{e.toEmail}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(e.createdAt)} · via {e.provider}
                        {e.error ? ` · ${e.error}` : ""}
                      </p>
                    </div>
                    <Badge variant={e.status === "sent" ? "outline" : "destructive"}>{e.status}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          ) : null}
        </Card>
      </div>
    </>
  );
}

function Meta({ label, value, mono, muted }: { label: string; value: string; mono?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${muted ? "text-muted-foreground" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : "text-right"}>{value}</span>
    </div>
  );
}
