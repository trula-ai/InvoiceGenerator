import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { BulkPlanSetup } from "@/components/installments/bulk-plan-setup";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { listInstallmentCandidates } from "@/lib/data/installment-candidates";
import { listInstallmentPlans } from "@/lib/data/installments";
import { syncOverdueStatuses } from "@/lib/data/invoices";
import { todayIso } from "@/lib/fiscal-year";
import { formatCurrency, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Recurring payments" };

export default async function RecurringPage() {
  const { business } = await requireUser();
  await syncOverdueStatuses(business.id);
  const [plans, candidates] = await Promise.all([listInstallmentPlans(business.id), listInstallmentCandidates(business.id)]);
  const today = todayIso();
  const active = plans.filter((p) => p.next);
  const settled = plans.filter((p) => !p.next);

  return (
    <>
      <PageHeader
        title="Recurring payments"
        description="Invoices paid in installments, EMI style. Each installment has its own due date, reminder and overdue status."
      />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold">Unpaid invoices</h2>
          <p className="text-sm text-muted-foreground">Select one or more invoices, then set up recurring payments for all of them in one go.</p>
        </div>
        <BulkPlanSetup candidates={candidates} />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold">Installment plans</h2>
          <p className="text-sm text-muted-foreground">
            {plans.length ? `${active.length} in progress · ${settled.length} fully paid` : "Plans you create appear here with their progress and next installment."}
          </p>
        </div>
        {plans.length > 0 ? (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="hidden md:table-cell">Client</TableHead>
                  <TableHead className="w-44">Progress</TableHead>
                  <TableHead className="hidden sm:table-cell">Next installment</TableHead>
                  <TableHead className="text-right">Next amount</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...active, ...settled].map((p) => {
                  const overdue = p.next ? p.next.dueDate < today : false;
                  return (
                    <TableRow key={p.invoiceId}>
                      <TableCell>
                        <Link href={`/dashboard/recurring/${p.invoiceId}`} className="font-medium hover:underline">
                          {p.invoiceNumber}
                        </Link>
                        <p className="text-xs text-muted-foreground md:hidden">{p.clientName}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Link href={`/dashboard/clients/${p.clientId}`} className="hover:underline">
                          {p.clientName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={(p.paidCount / p.count) * 100} className="h-1.5 flex-1" />
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {p.paidCount}/{p.count}
                          </span>
                        </div>
                        {p.overdueCount > 0 ? <p className="mt-1 text-xs text-destructive">{p.overdueCount} overdue</p> : null}
                      </TableCell>
                      <TableCell className={`hidden sm:table-cell ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                        {p.next ? `#${p.next.sequence} · ${formatDate(p.next.dueDate)}` : `Finished ${formatDate(p.endDate)}`}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{p.next ? formatCurrency(p.next.outstanding, p.currency) : "—"}</TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatCurrency(p.balanceDue, p.currency)}</TableCell>
                      <TableCell>{p.next ? <StatusBadge status={p.invoiceStatus} /> : <Badge variant="outline">All paid</Badge>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </section>
    </>
  );
}
