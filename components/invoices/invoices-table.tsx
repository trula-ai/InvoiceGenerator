import Link from "next/link";
import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { InvoiceListItem } from "@/lib/data/invoices";
import { formatCurrency, formatDate } from "@/lib/format";

export function InvoicesTable({ invoices, hasFilters }: { invoices: InvoiceListItem[]; hasFilters: boolean }) {
  if (invoices.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>{hasFilters ? "No invoices match these filters" : "No invoices yet"}</EmptyTitle>
          <EmptyDescription>{hasFilters ? "Adjust the search, status or date range." : "Create your first invoice to get started."}</EmptyDescription>
        </EmptyHeader>
        {!hasFilters ? (
          <EmptyContent>
            <Button nativeButton={false} render={<Link href="/dashboard/invoices/new" />}>
              New invoice
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead className="hidden sm:table-cell">Client</TableHead>
            <TableHead className="hidden md:table-cell">Issued</TableHead>
            <TableHead className="hidden lg:table-cell">Due</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Balance</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell>
                <Link href={`/dashboard/invoices/${inv.id}`} className="font-medium hover:underline">
                  {inv.invoiceNumber}
                </Link>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground sm:hidden">{inv.clientName}</div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Link href={`/dashboard/clients/${inv.clientId}`} className="hover:underline">
                  {inv.clientName}
                </Link>
                <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[10px] uppercase">
                  {inv.invoiceType}
                </Badge>
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(inv.issueDate)}</TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {formatDate(inv.dueDate)}
                {inv.lastReminderAt && ["pending", "partially_paid", "overdue"].includes(inv.status) ? (
                  <span className="block text-xs text-muted-foreground/80">Reminded {formatDate(inv.lastReminderAt)}</span>
                ) : null}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatCurrency(inv.total, inv.currency)}</TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                {["paid", "cancelled", "draft"].includes(inv.status) ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  formatCurrency(inv.balanceDue, inv.currency)
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={inv.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
