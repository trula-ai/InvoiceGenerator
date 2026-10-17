import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download, Mail } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AttributionCard } from "@/components/attribution/attribution-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { InstallmentScheduleTable } from "@/components/installments/installment-schedule-table";
import { RemovePlanButton } from "@/components/installments/remove-plan-button";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { EmailReceiptButton } from "@/components/payments/email-receipt-button";
import { EvidenceList } from "@/components/payments/evidence-list";
import { AddEvidenceButton, RejectPaymentDialog, ReversePaymentDialog, VerifyPaymentButton, WithdrawPaymentButton } from "@/components/payments/payment-review-actions";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import type { DocumentKind } from "@/db/schema";
import { can, requireUser } from "@/lib/auth/current-user";
import { amountInWords } from "@/lib/amount-in-words";
import { BASE_CURRENCY } from "@/lib/currency";
import { getInvoiceDetail, isInvoiceEditable, type RelatedDocument } from "@/lib/data/invoices";
import { getClientSalesOwner, getInvoiceAttribution, listAttributionEvents, listSalespeople } from "@/lib/data/attribution";
import { mapPaymentEvidence } from "@/lib/data/payments";
import { documentLabel, documentPath, secondDateLabel } from "@/lib/documents";
import { isEmailConfigured } from "@/lib/email/provider";
import { formatCurrency, formatDate, formatDateTime, formatRate } from "@/lib/format";
import { installmentOutstanding, nextUnpaidInstallment } from "@/lib/installments";
import { D, isZero, toMoney } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/payment";

/** Shared detail page for invoices, quotes and credit notes. */
export async function DocumentDetailPage({ kind, id }: { kind: DocumentKind; id: string }) {
  const current = await requireUser();
  const { business } = current;
  const detail = await getInvoiceDetail(business.id, id);
  if (!detail) notFound();
  if (detail.invoice.documentKind !== kind) redirect(documentPath(detail.invoice.documentKind, id));

  const { invoice, client, items, payments, installments, emails, source, convertedTo, creditNotes } = detail;
  const cur = invoice.currency;
  const verifiedPayments = payments.filter((p) => p.status === "verified");
  const pendingPayments = payments.filter((p) => p.status === "pending");
  const pendingTotal = toMoney(pendingPayments.reduce((acc, p) => acc.plus(D(p.amount)), D(0)));
  const evidenceByPayment = kind === "invoice" ? await mapPaymentEvidence(business.id, payments.map((p) => p.id)) : new Map();
  // Sales credit lives beside the payments, never inside them.
  const canAssignCredit = kind === "invoice" && can(current, "attribution.assign");
  const canApproveCredit = kind === "invoice" && can(current, "attribution.approve");
  const [attribution, salespeople, clientOwner] = kind === "invoice" ? await Promise.all([getInvoiceAttribution(business.id, id), listSalespeople(business.id), getClientSalesOwner(business.id, client.id)]) : [null, [], null];
  const attributionEvents = attribution ? await listAttributionEvents(business.id, attribution.id) : [];
  const defaultCreditUserId = clientOwner?.userId ?? (salespeople.some((p) => p.id === current.user.id) ? current.user.id : null);
  const showGst = invoice.gstApplied;
  const isInvoice = kind === "invoice";
  const hasPlan = installments.length > 0;
  const nextInstallment = hasPlan ? nextUnpaidInstallment(installments) : null;
  const paidInstallments = installments.filter((i) => D(i.paidAmount).greaterThanOrEqualTo(D(i.amount))).length;
  const clientAddress = [client.addressLine1, client.addressLine2, [client.city, client.state, client.postalCode].filter(Boolean).join(", "), client.country].filter(Boolean);
  const roundOff = D(invoice.roundOffAmount);
  const hasRelated = !!source || !!convertedTo || creditNotes.length > 0;

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoiceNumber}</h1>
              <StatusBadge status={invoice.status} overdue={invoice.isOverdue} kind={kind} />
              <Badge variant="secondary" className="uppercase">
                {invoice.invoiceType}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Issued {formatDate(invoice.issueDate)} · {hasPlan ? "Next installment due" : secondDateLabel(kind)} {formatDate(invoice.dueDate)} · FY {invoice.financialYear}
              {invoice.sentAt ? ` · Sent ${formatDateTime(invoice.sentAt)}` : ""}
              {invoice.recurringProfileId ? (
                <>
                  {" · "}
                  <Link href={`/dashboard/scheduled/${invoice.recurringProfileId}`} className="underline-offset-2 hover:underline">
                    Generated by a scheduled invoice
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          <InvoiceActions
            kind={kind}
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoiceNumber}
            status={invoice.status}
            currency={cur}
            balanceDue={invoice.balanceDue}
            hasPayments={verifiedPayments.length > 0}
            isOverdue={invoice.isOverdue}
            salesCredit={isInvoice && !attribution && canAssignCredit && salespeople.length ? { salespeople, defaultUserId: defaultCreditUserId } : null}
            editable={isInvoiceEditable(invoice)}
            converted={!!invoice.convertedToId}
            clientEmail={client.email}
            emailConfigured={isEmailConfigured()}
            publicToken={invoice.publicToken}
            installments={
              isInvoice
                ? {
                    hasPlan,
                    next: nextInstallment ? { sequence: nextInstallment.sequence, count: installments.length, outstanding: installmentOutstanding(nextInstallment) } : null,
                  }
                : undefined
            }
          />
        </div>
      </div>

      {hasPlan ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <CardTitle>Installments</CardTitle>
              <CardDescription>
                {paidInstallments} of {installments.length} paid
                {nextInstallment ? ` · next: installment ${nextInstallment.sequence}, ${formatCurrency(installmentOutstanding(nextInstallment), cur)} due ${formatDate(nextInstallment.dueDate)}` : " · plan complete"}
              </CardDescription>
            </div>
            {["pending", "partially_paid", "overdue"].includes(invoice.status) ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/dashboard/recurring/${invoice.id}`} />}>
                  Edit plan
                </Button>
                <RemovePlanButton invoiceId={invoice.id} />
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            <InstallmentScheduleTable installments={installments} currency={cur} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{kind === "quote" ? "Quote for" : "Bill to"}</CardTitle>
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
            {invoice.shipToAddress ? (
              <div className="mt-3 border-t pt-3">
                <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Ship to</p>
                <p className="whitespace-pre-line text-muted-foreground">{invoice.shipToAddress}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax & currency</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {invoice.poNumber ? <Meta label="PO number" value={invoice.poNumber} /> : null}
            {invoice.reference ? <Meta label="Reference" value={invoice.reference} /> : null}
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
            <CardTitle>{isInvoice ? "Balance" : kind === "quote" ? "Quoted amount" : "Credit"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm tabular-nums">
            <Meta label={kind === "credit_note" ? "Credit total" : "Total"} value={formatCurrency(invoice.total, cur)} />
            {isInvoice ? (
              <>
                <Meta label="Verified payments" value={formatCurrency(invoice.amountPaid, cur)} />
                {pendingPayments.length ? <Meta label="Awaiting verification" value={formatCurrency(pendingTotal, cur)} muted /> : null}
                {!isZero(invoice.creditAmount) ? <Meta label="Credit notes" value={`- ${formatCurrency(invoice.creditAmount, cur)}`} /> : null}
                <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
                  <span>Balance due</span>
                  <span className={!isZero(invoice.balanceDue) && invoice.isOverdue ? "text-destructive" : ""}>{formatCurrency(invoice.balanceDue, cur)}</span>
                </div>
              </>
            ) : null}
            {kind === "credit_note" && source ? (
              <Meta
                label="Applied to"
                value={
                  <Link href={documentPath("invoice", source.id)} className="hover:underline">
                    {source.invoiceNumber}
                  </Link>
                }
              />
            ) : null}
            {kind === "quote" && convertedTo ? (
              <Meta
                label="Invoiced as"
                value={
                  <Link href={documentPath("invoice", convertedTo.id)} className="hover:underline">
                    {convertedTo.invoiceNumber}
                  </Link>
                }
              />
            ) : null}
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
            {!roundOff.isZero() ? <Meta label="Round off" value={`${roundOff.greaterThan(0) ? "+" : "-"} ${formatCurrency(roundOff.abs().toFixed(2), cur)}`} /> : null}
            <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
              <span>{kind === "credit_note" ? "Credit total" : "Total"}</span>
              <span>{formatCurrency(invoice.total, cur)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{amountInWords(invoice.total, cur)}</p>
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

      {isInvoice && invoice.status !== "draft" ? (
        <AttributionCard
          invoiceId={invoice.id}
          attribution={attribution}
          events={attributionEvents}
          salespeople={salespeople}
          defaultUserId={defaultCreditUserId}
          currentUserId={current.user.id}
          canAssign={canAssignCredit}
          canApprove={canApproveCredit}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {isInvoice ? (
          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
              <CardDescription>
                {payments.length === 0
                  ? "No payments recorded yet."
                  : `${verifiedPayments.length} verified${pendingPayments.length ? `, ${pendingPayments.length} awaiting verification` : ""}${
                      payments.length - verifiedPayments.length - pendingPayments.length ? `, ${payments.length - verifiedPayments.length - pendingPayments.length} rejected or reversed` : ""
                    }.`}
              </CardDescription>
            </CardHeader>
            {payments.length > 0 ? (
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-36 text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => {
                      const label = `${formatCurrency(p.amount, cur)} from ${client.name}`;
                      const reason = p.status === "rejected" ? p.rejectionReason : p.status === "reversed" ? p.reversalReason : null;
                      return (
                        <TableRow key={p.id} className={p.status === "rejected" || p.status === "reversed" ? "opacity-70" : undefined}>
                          <TableCell className="font-medium">
                            {p.receiptNumber ?? <span className="text-muted-foreground">No receipt yet</span>}
                            {p.provider !== "manual" ? (
                              <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[10px] capitalize">
                                {p.provider}
                              </Badge>
                            ) : null}
                            <span className="block text-xs font-normal text-muted-foreground">
                              {PAYMENT_METHOD_LABELS[p.method]}
                              {p.reference ? ` · ${p.reference}` : ""}
                              {p.receivingAccount ? ` · into ${p.receivingAccount}` : ""}
                            </span>
                            {reason ? <span className="block text-xs font-normal text-destructive">{p.status === "rejected" ? "Rejected" : "Reversed"}: {reason}</span> : null}
                            <div className="mt-1">
                              <EvidenceList paymentId={p.id} evidence={evidenceByPayment.get(p.id) ?? []} emptyLabel={p.status === "pending" ? "No proof attached" : null} />
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(p.paymentDate)}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <PaymentStatusBadge status={p.status} />
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{formatCurrency(p.amount, cur)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {p.status === "pending" ? (
                                <>
                                  {can(current, "payments.record") ? <AddEvidenceButton compact paymentId={p.id} invoiceId={invoice.id} /> : null}
                                  {can(current, "payments.verify") ? (
                                    <>
                                      <VerifyPaymentButton compact paymentId={p.id} invoiceId={invoice.id} label={label} />
                                      <RejectPaymentDialog compact paymentId={p.id} invoiceId={invoice.id} label={label} />
                                    </>
                                  ) : null}
                                  {can(current, "payments.record") ? <WithdrawPaymentButton compact paymentId={p.id} invoiceId={invoice.id} label={label} /> : null}
                                </>
                              ) : null}
                              {p.status === "verified" ? (
                                <>
                                  <Button variant="ghost" size="icon-sm" aria-label="Download receipt" nativeButton={false} render={<a href={`/api/payments/${p.id}/receipt?download=1`} />}>
                                    <Download />
                                  </Button>
                                  {can(current, "receipts.send") ? (
                                    <EmailReceiptButton compact paymentId={p.id} receiptNumber={p.receiptNumber ?? ""} clientEmail={client.email} emailConfigured={isEmailConfigured()} />
                                  ) : null}
                                  {can(current, "payments.reverse") ? <ReversePaymentDialog compact paymentId={p.id} invoiceId={invoice.id} label={label} /> : null}
                                </>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            ) : null}
          </Card>
        ) : null}

        {hasRelated || isInvoice ? (
          <Card>
            <CardHeader>
              <CardTitle>Related documents</CardTitle>
              <CardDescription>
                {isInvoice
                  ? creditNotes.length === 0
                    ? source
                      ? "Converted from a quote."
                      : "No credit notes have been issued against this invoice."
                    : `${creditNotes.length} credit note${creditNotes.length === 1 ? "" : "s"} issued against this invoice.`
                  : kind === "quote"
                    ? convertedTo
                      ? "This quote has been converted."
                      : "Not converted yet."
                    : "The invoice this credit note is applied to."}
              </CardDescription>
            </CardHeader>
            {hasRelated ? (
              <CardContent>
                <ul className="divide-y text-sm">
                  {source ? <RelatedRow doc={source} relation={kind === "credit_note" ? "Against invoice" : "From quote"} /> : null}
                  {convertedTo ? <RelatedRow doc={convertedTo} relation="Converted to" /> : null}
                  {creditNotes.map((cn) => (
                    <RelatedRow key={cn.id} doc={cn} relation="Credit note" />
                  ))}
                </ul>
              </CardContent>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Email history</CardTitle>
            <CardDescription>{emails.length === 0 ? `This ${documentLabel(kind).toLowerCase()} has not been emailed.` : `${emails.length} attempt${emails.length === 1 ? "" : "s"}.`}</CardDescription>
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

function RelatedRow({ doc, relation }: { doc: RelatedDocument; relation: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <Link href={documentPath(doc.documentKind, doc.id)} className="font-medium hover:underline">
          {doc.invoiceNumber}
        </Link>
        <p className="text-xs text-muted-foreground">
          {relation} · {formatDate(doc.issueDate)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-medium tabular-nums">{formatCurrency(doc.total, doc.currency)}</span>
        <StatusBadge status={doc.status} kind={doc.documentKind} />
      </div>
    </li>
  );
}

function Meta({ label, value, mono, muted }: { label: string; value: React.ReactNode; mono?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${muted ? "text-muted-foreground" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : "text-right"}>{value}</span>
    </div>
  );
}
