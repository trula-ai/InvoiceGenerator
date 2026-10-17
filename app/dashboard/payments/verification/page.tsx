import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { EvidenceList } from "@/components/payments/evidence-list";
import { AddEvidenceButton, RejectPaymentDialog, VerifyPaymentButton } from "@/components/payments/payment-review-actions";
import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/current-user";
import { listVerificationQueue } from "@/lib/data/payments";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/payment";

export const metadata: Metadata = { title: "Payment verification" };

/**
 * Finance queue: every manual payment awaiting verification, with the
 * details and proof needed to match it against the bank or gateway account.
 */
export default async function PaymentVerificationPage() {
  const { business } = await requirePermission("payments.verify");
  const queue = await listVerificationQueue(business.id);

  return (
    <>
      <PageHeader
        title="Payment verification"
        description={
          queue.length === 0
            ? "Payments recorded by the team appear here until finance confirms the money arrived."
            : `${queue.length} payment${queue.length === 1 ? "" : "s"} waiting. Match each one against the bank or gateway statement before verifying.`
        }
      />

      {queue.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BadgeCheck />
            </EmptyMedia>
            <EmptyTitle>Nothing to verify</EmptyTitle>
            <EmptyDescription>Every recorded payment has been reviewed. New entries will show up here as soon as they are saved.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {queue.map((item) => {
            const label = `${formatCurrency(item.amount, item.currency)} from ${item.clientName}`;
            return (
              <Card key={item.id} className={item.duplicates.length ? "border-amber-500/40" : undefined}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <CardTitle className="flex flex-wrap items-center gap-2">
                        <span className="tabular-nums">{formatCurrency(item.amount, item.currency)}</span>
                        <span className="font-normal text-muted-foreground">from</span>
                        <Link href={`/dashboard/clients/${item.clientId}`} className="hover:underline">
                          {item.clientName}
                        </Link>
                        <span className="font-normal text-muted-foreground">against</span>
                        <Link href={`/dashboard/invoices/${item.invoiceId}`} className="hover:underline">
                          {item.invoiceNumber}
                        </Link>
                      </CardTitle>
                      <CardDescription>
                        Received {formatDate(item.paymentDate)} by {PAYMENT_METHOD_LABELS[item.method].toLowerCase()}
                        {item.receivingAccount ? ` into ${item.receivingAccount}` : ""} · recorded {formatDateTime(item.createdAt)}
                        {item.recordedByName ? ` by ${item.recordedByName}` : ""}
                        {item.daysPending > 0 ? ` · waiting ${item.daysPending} day${item.daysPending === 1 ? "" : "s"}` : ""}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <AddEvidenceButton paymentId={item.id} invoiceId={item.invoiceId} />
                      <RejectPaymentDialog paymentId={item.id} invoiceId={item.invoiceId} label={label} />
                      <VerifyPaymentButton paymentId={item.id} invoiceId={item.invoiceId} label={label} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm md:grid-cols-[1fr_1fr_1.4fr]">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Reference</p>
                    <p className="font-mono">{item.reference ?? <span className="font-sans text-muted-foreground">none given</span>}</p>
                    {item.duplicates.length ? (
                      <div className="mt-1 flex flex-col gap-1 rounded-md border border-amber-500/40 bg-amber-500/5 p-2">
                        <p className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                          <TriangleAlert className="size-3.5" /> Same reference as
                        </p>
                        <ul className="text-xs text-muted-foreground">
                          {item.duplicates.map((d) => (
                            <li key={d.paymentId}>
                              {d.receiptNumber ?? "pending"} · {d.invoiceNumber} · {formatCurrency(d.amount, item.currency)} on {formatDate(d.paymentDate)} ({d.status})
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Invoice balance</p>
                    <p className="tabular-nums">{formatCurrency(item.invoiceBalanceDue, item.currency)} outstanding (verified payments only)</p>
                    {Number(item.amount) > Number(item.invoiceBalanceDue) ? (
                      <Badge variant="destructive" className="w-fit">
                        Exceeds balance
                      </Badge>
                    ) : null}
                    {item.notes ? <p className="mt-1 whitespace-pre-line text-muted-foreground">{item.notes}</p> : null}
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Proof</p>
                    <EvidenceList paymentId={item.id} evidence={item.evidence} emptyLabel="No proof attached. A screenshot alone does not prove cleared funds; check the account." />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
