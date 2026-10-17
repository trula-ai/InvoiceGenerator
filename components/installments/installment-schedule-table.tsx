import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InvoiceInstallment } from "@/db/schema";
import { todayIso } from "@/lib/fiscal-year";
import { formatCurrency, formatDate } from "@/lib/format";
import { INSTALLMENT_STATE_LABELS, installmentOutstanding, installmentState, type InstallmentState } from "@/lib/installments";

const DOT: Record<InstallmentState, string> = {
  paid: "bg-emerald-500",
  partial: "bg-sky-500",
  overdue: "bg-destructive",
  due_today: "bg-amber-500",
  upcoming: "bg-muted-foreground/50",
};

interface InstallmentScheduleTableProps {
  installments: InvoiceInstallment[];
  currency: string;
  /** Hide the "Paid" column, e.g. on the public page where only what is left matters. */
  compact?: boolean;
  className?: string;
}

/** Read-only table of an installment plan. Works in server and client components. */
export function InstallmentScheduleTable({ installments, currency, compact = false, className }: InstallmentScheduleTableProps) {
  const today = todayIso();
  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          <TableHead>Due</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          {compact ? null : <TableHead className="hidden text-right sm:table-cell">Paid</TableHead>}
          <TableHead className="text-right">Outstanding</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {installments.map((row) => {
          const state = installmentState(row, today);
          return (
            <TableRow key={row.id} className={state === "paid" ? "text-muted-foreground" : undefined}>
              <TableCell className="text-muted-foreground">{row.sequence}</TableCell>
              <TableCell className={cn(state === "overdue" && "font-medium text-destructive")}>{formatDate(row.dueDate)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.amount, currency)}</TableCell>
              {compact ? null : <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatCurrency(row.paidAmount, currency)}</TableCell>}
              <TableCell className="text-right font-medium tabular-nums">{formatCurrency(installmentOutstanding(row), currency)}</TableCell>
              <TableCell>
                <Badge variant="outline" className="gap-1.5 font-medium">
                  <span className={cn("size-1.5 rounded-full", DOT[state])} aria-hidden />
                  {INSTALLMENT_STATE_LABELS[state]}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
