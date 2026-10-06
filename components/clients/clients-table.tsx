import Link from "next/link";
import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SendStatementDialog } from "@/components/clients/send-statement-dialog";
import type { ClientListItem } from "@/lib/data/clients";
import { BASE_CURRENCY } from "@/lib/currency";
import { formatCurrency } from "@/lib/format";

interface ClientsTableProps {
  clients: ClientListItem[];
  hasFilters: boolean;
  emailConfigured: boolean;
}

export function ClientsTable({ clients, hasFilters, emailConfigured }: ClientsTableProps) {
  if (clients.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>{hasFilters ? "No clients match your search" : "No clients yet"}</EmptyTitle>
          <EmptyDescription>
            {hasFilters ? "Try a different name, email or GSTIN." : "Add your first client to start creating invoices."}
          </EmptyDescription>
        </EmptyHeader>
        {!hasFilters ? (
          <EmptyContent>
            <Button nativeButton={false} render={<Link href="/dashboard/clients/new" />}>
              Add client
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
            <TableHead>Client</TableHead>
            <TableHead className="hidden md:table-cell">Contact</TableHead>
            <TableHead className="hidden lg:table-cell">GSTIN</TableHead>
            <TableHead className="hidden sm:table-cell text-right">Invoices</TableHead>
            <TableHead className="text-right">Invoiced ({BASE_CURRENCY})</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead className="w-12 text-right">
              <span className="sr-only">Send reminder</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => {
            const hasOutstanding = Number(client.outstandingInr) > 0;
            return (
              <TableRow key={client.id}>
                <TableCell>
                  <Link href={`/dashboard/clients/${client.id}`} className="font-medium hover:underline">
                    {client.name}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px] uppercase">
                      {client.type}
                    </Badge>
                    {client.currency}
                    {client.archivedAt ? <span>· Archived</span> : null}
                    {!client.autoReminders ? <span>· Auto reminders off</span> : null}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="text-sm">{client.contactName ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{client.email ?? client.phone ?? ""}</div>
                </TableCell>
                <TableCell className="hidden font-mono text-xs lg:table-cell">{client.gstin ?? "—"}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{client.invoiceCount}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatCurrency(client.totalInvoicedInr, BASE_CURRENCY)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className={hasOutstanding ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                    {formatCurrency(client.outstandingInr, BASE_CURRENCY)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <SendStatementDialog
                    compact
                    clientId={client.id}
                    clientName={client.name}
                    clientEmail={client.email}
                    hasOutstanding={hasOutstanding}
                    outstandingLabel={hasOutstanding ? `${formatCurrency(client.outstandingInr, BASE_CURRENCY)} outstanding` : undefined}
                    emailConfigured={emailConfigured}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
