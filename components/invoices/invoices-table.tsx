import Link from "next/link";
import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { DocumentKind } from "@/db/schema";
import type { InvoiceListItem } from "@/lib/data/invoices";
import { documentBasePath, documentLabel, documentLabelPlural, documentPath, secondDateLabel } from "@/lib/documents";
import { formatCurrency, formatDate } from "@/lib/format";

interface InvoicesTableProps {
  invoices: InvoiceListItem[];
  hasFilters: boolean;
  kind?: DocumentKind;
}

const EMPTY_COPY: Record<DocumentKind, string> = {
  invoice: "Create your first invoice to get started.",
  quote: "Send a quote, let the client accept it online, then convert it to an invoice in one click.",
  credit_note: "Credit notes are created from an issued invoice: open the invoice and choose Credit note.",
};

export function InvoicesTable({ invoices, hasFilters, kind = "invoice" }: InvoicesTableProps) {
  const label = documentLabel(kind);
  const isInvoice = kind === "invoice";

  if (invoices.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>{hasFilters ? `No ${documentLabelPlural(kind).toLowerCase()} match these filters` : `No ${documentLabelPlural(kind).toLowerCase()} yet`}</EmptyTitle>
          <EmptyDescription>{hasFilters ? "Adjust the search, status or date range." : EMPTY_COPY[kind]}</EmptyDescription>
        </EmptyHeader>
        {!hasFilters && kind !== "credit_note" ? (
          <EmptyContent>
            <Button nativeButton={false} render={<Link href={`${documentBasePath(kind)}/new`} />}>
              New {label.toLowerCase()}
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
            <TableHead>{label}</TableHead>
            <TableHead className="hidden sm:table-cell">Client</TableHead>
            <TableHead className="hidden md:table-cell">Issued</TableHead>
            <TableHead className="hidden lg:table-cell">{kind === "credit_note" ? "Against" : secondDateLabel(kind)}</TableHead>
            <TableHead className="text-right">Total</TableHead>
            {isInvoice ? <TableHead className="hidden text-right sm:table-cell">Balance</TableHead> : null}
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell>
                <Link href={documentPath(kind, inv.id)} className="font-medium hover:underline">
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
                {kind === "credit_note" ? (
                  inv.sourceNumber ?? "—"
                ) : (
                  <>
                    {formatDate(inv.dueDate)}
                    {isInvoice && inv.lastReminderAt && ["pending", "partially_paid", "overdue"].includes(inv.status) ? (
                      <span className="block text-xs text-muted-foreground/80">Reminded {formatDate(inv.lastReminderAt)}</span>
                    ) : null}
                    {isInvoice && inv.sourceNumber ? <span className="block text-xs text-muted-foreground/80">From {inv.sourceNumber}</span> : null}
                  </>
                )}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatCurrency(inv.total, inv.currency)}</TableCell>
              {isInvoice ? (
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {["paid", "cancelled", "draft"].includes(inv.status) ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    formatCurrency(inv.balanceDue, inv.currency)
                  )}
                </TableCell>
              ) : null}
              <TableCell>
                <StatusBadge status={inv.status} kind={kind} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
