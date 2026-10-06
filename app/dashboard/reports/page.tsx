import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/shared/date-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MonthlyBars } from "@/components/charts/monthly-bars";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import type { InvoiceStatus } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { BASE_CURRENCY } from "@/lib/currency";
import {
  defaultReportRange,
  getMonthlyBreakdown,
  getReportSummary,
  getRevenueByClient,
  getRevenueByCurrency,
  getStatusBreakdown,
} from "@/lib/data/reports";
import { addDaysIso, currentFinancialYear, financialYearRange, todayIso } from "@/lib/fiscal-year";
import { formatCurrency, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Reports" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReportsPage({ searchParams }: PageProps<"/dashboard/reports">) {
  const { business } = await requireUser();
  const params = await searchParams;
  const fromParam = typeof params.from === "string" && ISO.test(params.from) ? params.from : undefined;
  const toParam = typeof params.to === "string" && ISO.test(params.to) ? params.to : undefined;
  const range = fromParam && toParam && fromParam <= toParam ? { from: fromParam, to: toParam } : defaultReportRange();

  const [summary, monthly, byClient, byCurrency, byStatus] = await Promise.all([
    getReportSummary(business.id, range),
    getMonthlyBreakdown(business.id, range),
    getRevenueByClient(business.id, range),
    getRevenueByCurrency(business.id, range),
    getStatusBreakdown(business.id, range),
  ]);

  const fy = currentFinancialYear();
  const prevFy = `${Number(fy.slice(0, 4)) - 1}-${fy.slice(0, 4).slice(2)}`;
  const quick = [
    { label: `FY ${fy}`, ...financialYearRange(fy) },
    { label: `FY ${prevFy}`, ...financialYearRange(prevFy) },
    { label: "Last 30 days", from: addDaysIso(todayIso(), -30), to: todayIso() },
  ];
  const collectionRate = Number(summary.invoicedInr) > 0 ? Math.round((Number(summary.collectedInr) / Number(summary.invoicedInr)) * 100) : 0;

  return (
    <>
      <PageHeader title="Reports" description={`Revenue, collections and outstanding balances in ${BASE_CURRENCY} for ${formatDate(range.from)} to ${formatDate(range.to)}.`} />

      <form method="get" className="flex flex-wrap items-center gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
        <DatePicker name="from" defaultValue={range.from} className="w-44" />
        <span className="text-sm text-muted-foreground">to</span>
        <DatePicker name="to" defaultValue={range.to} className="w-44" />
        <Button type="submit" variant="outline">
          Apply
        </Button>
        <div className="ml-auto flex flex-wrap gap-1">
          {quick.map((qr) => (
            <Button key={qr.label} variant="ghost" size="sm" nativeButton={false} render={<Link href={`/dashboard/reports?from=${qr.from}&to=${qr.to}`} />}>
              {qr.label}
            </Button>
          ))}
        </div>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
        <Stat title="Invoiced" value={formatCurrency(summary.invoicedInr, BASE_CURRENCY)} hint={`${summary.invoiceCount} invoice${summary.invoiceCount === 1 ? "" : "s"}`} />
        <Stat title="Collected" value={formatCurrency(summary.collectedInr, BASE_CURRENCY)} hint={`${collectionRate}% of invoiced`} tone="success" />
        <Stat title="Outstanding" value={formatCurrency(summary.outstandingInr, BASE_CURRENCY)} hint={`${formatCurrency(summary.overdueInr, BASE_CURRENCY)} overdue`} tone={Number(summary.overdueInr) > 0 ? "danger" : "warning"} />
        <Stat title="Tax billed" value={formatCurrency(summary.taxInr, BASE_CURRENCY)} hint={`Avg invoice ${formatCurrency(summary.averageInvoiceInr, BASE_CURRENCY)}`} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Monthly revenue</CardTitle>
          <CardDescription>Invoiced (light) vs collected (dark) per month.</CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyBars rows={monthly} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top clients</CardTitle>
            <CardDescription>By invoiced amount in the period.</CardDescription>
          </CardHeader>
          <CardContent>
            {byClient.length === 0 ? (
              <p className="text-sm text-muted-foreground">No issued invoices in this period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byClient.map((c) => (
                    <TableRow key={c.clientId}>
                      <TableCell>
                        <Link href={`/dashboard/clients/${c.clientId}`} className="font-medium hover:underline">
                          {c.clientName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.invoiceCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(c.invoicedInr, BASE_CURRENCY)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(c.outstandingInr, BASE_CURRENCY)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice statistics</CardTitle>
              <CardDescription>Count and value by status in the period.</CardDescription>
            </CardHeader>
            <CardContent>
              {byStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices in this period.</p>
              ) : (
                <Table>
                  <TableBody>
                    {byStatus.map((s) => (
                      <TableRow key={s.status}>
                        <TableCell>
                          <StatusBadge status={s.status as InvoiceStatus} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{s.count}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(s.totalInr, BASE_CURRENCY)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By currency</CardTitle>
              <CardDescription>Original currency totals and their {BASE_CURRENCY} equivalent.</CardDescription>
            </CardHeader>
            <CardContent>
              {byCurrency.length === 0 ? (
                <p className="text-sm text-muted-foreground">No issued invoices in this period.</p>
              ) : (
                <Table>
                  <TableBody>
                    {byCurrency.map((c) => (
                      <TableRow key={c.currency}>
                        <TableCell className="font-medium">{c.currency}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.invoiceCount}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(c.total, c.currency)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(c.totalInr, BASE_CURRENCY)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({ title, value, hint, tone = "default" }: { title: string; value: string; hint: string; tone?: "default" | "success" | "warning" | "danger" }) {
  const color = { default: "", success: "text-emerald-600 dark:text-emerald-400", warning: "text-amber-600 dark:text-amber-400", danger: "text-destructive" }[tone];
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className={`text-2xl font-semibold tracking-tight tabular-nums ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
