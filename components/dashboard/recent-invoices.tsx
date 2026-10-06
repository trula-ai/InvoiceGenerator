import Link from "next/link";
import { FileText } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { RecentInvoice } from "@/lib/types/dashboard";
import { formatCurrency, formatDate } from "@/lib/format";

interface RecentInvoicesProps {
  invoices: RecentInvoice[];
  className?: string;
}

export function RecentInvoices({ invoices, className }: RecentInvoicesProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle>Recent invoices</CardTitle>
        <CardDescription>The latest invoices issued to your clients</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboard/invoices" />}>
            View all
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1">
        {invoices.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices yet" description="Invoices you create will appear here." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead className="hidden sm:table-cell">Client</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    <Link href={`/dashboard/invoices/${invoice.id}`} className="hover:underline">
                      {invoice.number}
                    </Link>
                    <span className="block text-xs font-normal text-muted-foreground sm:hidden">{invoice.client}</span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{invoice.client}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(invoice.issuedAt)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
