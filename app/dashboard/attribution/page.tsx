import type { Metadata } from "next";
import Link from "next/link";
import { UserRoundCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApproveAttributionButton, ReassignAttributionDialog, RejectAttributionDialog } from "@/components/attribution/attribution-actions";
import { AttributionStatusBadge } from "@/components/attribution/attribution-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/current-user";
import { listAttributionQueue, listSalespeople } from "@/lib/data/attribution";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Sales attribution" };

/**
 * Sales manager queue: every proposed sales credit waiting for a decision,
 * plus the most recent decisions for reference. Payment state is shown as
 * context only; it is reviewed on the verification page, never here.
 */
export default async function AttributionQueuePage() {
  const { user, business } = await requirePermission("attribution.approve");
  const [pending, decided, salespeople] = await Promise.all([
    listAttributionQueue(business.id, ["pending"]),
    listAttributionQueue(business.id, ["approved", "rejected"]),
    listSalespeople(business.id),
  ]);
  const recent = [...decided].sort((a, b) => (b.reviewedAt?.getTime() ?? 0) - (a.reviewedAt?.getTime() ?? 0)).slice(0, 15);

  return (
    <>
      <PageHeader
        title="Sales attribution"
        description={
          pending.length === 0
            ? "Proposed sales credits appear here until a sales manager approves, rejects or reassigns them."
            : `${pending.length} proposal${pending.length === 1 ? "" : "s"} waiting. Confirm who really owns each sale; approving here never verifies a payment.`
        }
      />

      {pending.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRoundCheck />
            </EmptyMedia>
            <EmptyTitle>Nothing to approve</EmptyTitle>
            <EmptyDescription>Salespeople credit a sale from the invoice page or while recording its first payment.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {pending.map((item) => {
            const label = `${item.creditedName} for ${item.invoiceNumber}`;
            const selfProposed = item.creditedUserId === user.id;
            return (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <CardTitle className="flex flex-wrap items-center gap-2">
                        <span>{item.creditedName}</span>
                        <span className="font-normal text-muted-foreground">for</span>
                        <Link href={`/dashboard/invoices/${item.invoiceId}`} className="hover:underline">
                          {item.invoiceNumber}
                        </Link>
                        <span className="font-normal text-muted-foreground">·</span>
                        <Link href={`/dashboard/clients/${item.clientId}`} className="hover:underline">
                          {item.clientName}
                        </Link>
                        {selfProposed ? (
                          <Badge variant="secondary" title="You cannot approve a sale credited to yourself unless you are an admin">
                            Credited to you
                          </Badge>
                        ) : null}
                      </CardTitle>
                      <CardDescription>
                        {formatCurrency(item.invoiceTotal, item.currency)} invoice issued {formatDate(item.issueDate)} · proposed {formatDateTime(item.assignedAt)}
                        {item.assignedByName ? ` by ${item.assignedByName}` : ""}
                        {item.previousCreditedName ? ` · previously ${item.previousCreditedName}` : ""}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <ReassignAttributionDialog attributionId={item.id} invoiceId={item.invoiceId} label={label} salespeople={salespeople} currentUserId={user.id} />
                      <RejectAttributionDialog attributionId={item.id} invoiceId={item.invoiceId} label={label} />
                      <ApproveAttributionButton attributionId={item.id} invoiceId={item.invoiceId} label={label} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm md:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Proposer&apos;s note</p>
                    <p className={item.reason ? "" : "text-muted-foreground"}>{item.reason ?? "none"}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Invoice</p>
                    <StatusBadge status={item.invoiceStatus as "pending"} className="w-fit" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Payments (finance decides separately)</p>
                    <p className="text-muted-foreground">
                      {item.verifiedPaymentCount} verified · {item.pendingPaymentCount} awaiting verification
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {recent.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent decisions</CardTitle>
            <CardDescription>The last {recent.length} approved or rejected proposals. Approved sales can still be reassigned from the invoice page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="hidden sm:table-cell">Client</TableHead>
                  <TableHead>Credited to</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead className="hidden md:table-cell">By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link href={`/dashboard/invoices/${item.invoiceId}`} className="font-medium hover:underline">
                        {item.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{item.clientName}</TableCell>
                    <TableCell>
                      {item.creditedName}
                      {item.previousCreditedName ? <span className="block text-xs text-muted-foreground">was {item.previousCreditedName}</span> : null}
                    </TableCell>
                    <TableCell>
                      <AttributionStatusBadge status={item.status} />
                      {item.reviewNote ? <span className="block max-w-56 truncate text-xs text-muted-foreground" title={item.reviewNote}>{item.reviewNote}</span> : null}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {item.reviewedByName ?? "—"}
                      {item.reviewedAt ? <span className="block text-xs">{formatDateTime(item.reviewedAt)}</span> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
