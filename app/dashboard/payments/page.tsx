import type { Metadata } from "next";
import Link from "next/link";
import { Download, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { DatePicker } from "@/components/shared/date-picker";
import { PAYMENT_METHOD_OPTIONS, withAll } from "@/components/shared/options";
import { SelectField } from "@/components/shared/select-field";
import { SearchSuggestInput } from "@/components/shared/search-suggest";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import type { PaymentMethod } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { exportHref } from "@/lib/csv";
import { BASE_CURRENCY } from "@/lib/currency";
import { listPayments } from "@/lib/data/payments";
import { formatCurrency, formatDate } from "@/lib/format";
import { D, toMoney } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/validation/payment";

export const metadata: Metadata = { title: "Payments" };

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export default async function PaymentsPage({ searchParams }: PageProps<"/dashboard/payments">) {
  const { business } = await requireUser();
  const params = await searchParams;
  const q = str(params.q);
  const methodParam = str(params.method);
  const method = PAYMENT_METHODS.includes(methodParam as PaymentMethod) ? (methodParam as PaymentMethod) : undefined;
  const from = str(params.from);
  const to = str(params.to);
  const hasFilters = !!(q || method || from || to);

  const payments = await listPayments(business.id, { q, method, from, to });
  const totalInr = toMoney(payments.reduce((acc, p) => acc.plus(D(p.amountInr)), D(0)));
  const csvHref = exportHref("/api/export/payments", { q, method, from, to });

  return (
    <>
      <PageHeader title="Payments" description={`${payments.length} payment${payments.length === 1 ? "" : "s"} · ${formatCurrency(totalInr, BASE_CURRENCY)} received${hasFilters ? " (filtered)" : ""}.`}>
        <Button variant="outline" nativeButton={false} render={<a href={csvHref} />}>
          <Download /> Export CSV
        </Button>
      </PageHeader>

      <form method="get" className="grid gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_170px_150px_150px_auto]">
        <SearchSuggestInput kind="payment" defaultValue={q} placeholder="Receipt, invoice, client or reference" />
        <SelectField name="method" defaultValue={method ?? ""} options={withAll("All methods", PAYMENT_METHOD_OPTIONS)} />
        <DatePicker name="from" defaultValue={from} placeholder="From" allowClear />
        <DatePicker name="to" defaultValue={to} placeholder="To" allowClear />
        <div className="flex gap-2">
          <Button type="submit" variant="outline" className="flex-1">
            Filter
          </Button>
          {hasFilters ? (
            <Button variant="ghost" nativeButton={false} render={<Link href="/dashboard/payments" />}>
              Clear
            </Button>
          ) : null}
        </div>
      </form>

      {payments.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Wallet />
            </EmptyMedia>
            <EmptyTitle>{hasFilters ? "No payments match these filters" : "No payments yet"}</EmptyTitle>
            <EmptyDescription>{hasFilters ? "Adjust the search or date range." : "Record payments from an invoice's page."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="hidden sm:table-cell">Client</TableHead>
                <TableHead className="hidden md:table-cell">Invoice</TableHead>
                <TableHead className="hidden lg:table-cell">Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden text-right xl:table-cell">{BASE_CURRENCY}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.receiptNumber}
                    {p.reference ? <span className="block text-xs font-normal text-muted-foreground">{p.reference}</span> : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.paymentDate)}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Link href={`/dashboard/clients/${p.clientId}`} className="hover:underline">
                      {p.clientName}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Link href={`/dashboard/invoices/${p.invoiceId}`} className="hover:underline">
                      {p.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{PAYMENT_METHOD_LABELS[p.method]}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatCurrency(p.amount, p.invoiceCurrency)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums text-muted-foreground xl:table-cell">{formatCurrency(p.amountInr, BASE_CURRENCY)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" aria-label="Download receipt" nativeButton={false} render={<a href={`/api/payments/${p.id}/receipt?download=1`} />}>
                      <Download />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
