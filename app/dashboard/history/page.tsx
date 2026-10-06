import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, Download, FileText, History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { DatePicker } from "@/components/shared/date-picker";
import { withAll } from "@/components/shared/options";
import { SelectField } from "@/components/shared/select-field";
import { SearchSuggestInput } from "@/components/shared/search-suggest";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { exportHref } from "@/lib/csv";
import { BASE_CURRENCY } from "@/lib/currency";
import { listClientOptions } from "@/lib/data/clients";
import { getTransactionHistory, type HistoryEntryKind } from "@/lib/data/history";
import { formatCurrency, formatDate } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/payment";

export const metadata: Metadata = { title: "History" };

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export default async function HistoryPage({ searchParams }: PageProps<"/dashboard/history">) {
  const { business } = await requireUser();
  const params = await searchParams;
  const q = str(params.q);
  const kindParam = str(params.kind);
  const kind = kindParam === "invoice" || kindParam === "payment" ? (kindParam as HistoryEntryKind) : undefined;
  const clientId = str(params.client);
  const from = str(params.from);
  const to = str(params.to);
  const hasFilters = !!(q || kind || clientId || from || to);

  const [entries, clients] = await Promise.all([
    getTransactionHistory(business.id, { q, kind, clientId, from, to }),
    listClientOptions(business.id),
  ]);
  const csvHref = exportHref("/api/export/history", { q, kind, client: clientId, from, to });

  return (
    <>
      <PageHeader title="Transaction history" description="Every invoice issued and every payment received, in one timeline.">
        <Button variant="outline" nativeButton={false} render={<a href={csvHref} />}>
          <Download /> Export CSV
        </Button>
      </PageHeader>

      <form method="get" className="grid gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_150px_200px_150px_150px_auto]">
        <SearchSuggestInput kind="history" defaultValue={q} placeholder="Invoice, receipt or client" />
        <SelectField
          name="kind"
          defaultValue={kind ?? ""}
          options={[
            { value: "", label: "Invoices & payments" },
            { value: "invoice", label: "Invoices only" },
            { value: "payment", label: "Payments only" },
          ]}
        />
        <SelectField name="client" defaultValue={clientId ?? ""} options={withAll("All clients", clients.map((c) => ({ value: c.id, label: c.name })))} />
        <DatePicker name="from" defaultValue={from} placeholder="From" allowClear />
        <DatePicker name="to" defaultValue={to} placeholder="To" allowClear />
        <div className="flex gap-2">
          <Button type="submit" variant="outline" className="flex-1">
            Filter
          </Button>
          {hasFilters ? (
            <Button variant="ghost" nativeButton={false} render={<Link href="/dashboard/history" />}>
              Clear
            </Button>
          ) : null}
        </div>
      </form>

      {entries.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <History />
            </EmptyMedia>
            <EmptyTitle>{hasFilters ? "Nothing matches these filters" : "No transactions yet"}</EmptyTitle>
            <EmptyDescription>{hasFilters ? "Try widening the date range." : "Invoices and payments will appear here as you create them."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="hidden sm:table-cell">Client</TableHead>
                <TableHead className="hidden md:table-cell">Details</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden text-right lg:table-cell">{BASE_CURRENCY}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={`${e.kind}-${e.id}`}>
                  <TableCell className="text-muted-foreground">{formatDate(e.date)}</TableCell>
                  <TableCell>
                    <Badge variant={e.kind === "payment" ? "default" : "outline"} className="gap-1">
                      {e.kind === "payment" ? <ArrowDownLeft /> : <FileText />}
                      {e.kind === "payment" ? "Payment" : "Invoice"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={e.href} className="hover:underline">
                      {e.reference}
                    </Link>
                    {e.relatedReference ? <span className="block text-xs font-normal text-muted-foreground">for {e.relatedReference}</span> : null}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Link href={`/dashboard/clients/${e.clientId}`} className="hover:underline">
                      {e.clientName}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {e.kind === "invoice" && e.status ? <StatusBadge status={e.status} /> : null}
                    {e.kind === "payment" && e.method ? (
                      <span className="text-sm text-muted-foreground">{PAYMENT_METHOD_LABELS[e.method as keyof typeof PAYMENT_METHOD_LABELS] ?? e.method}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className={`text-right font-medium tabular-nums ${e.kind === "payment" ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                    {e.kind === "payment" ? "+" : ""}
                    {formatCurrency(e.amount, e.currency)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums text-muted-foreground lg:table-cell">{formatCurrency(e.amountInr, BASE_CURRENCY)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
