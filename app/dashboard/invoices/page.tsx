import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/shared/date-picker";
import { INVOICE_STATUS_OPTIONS, withAll } from "@/components/shared/options";
import { SelectField } from "@/components/shared/select-field";
import { SearchSuggestInput } from "@/components/shared/search-suggest";
import { InvoicesTable } from "@/components/invoices/invoices-table";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import type { InvoiceStatus } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { exportHref } from "@/lib/csv";
import { listClientOptions } from "@/lib/data/clients";
import { listInvoices } from "@/lib/data/invoices";

export const metadata: Metadata = { title: "Invoices" };

const STATUSES: InvoiceStatus[] = ["draft", "pending", "partially_paid", "paid", "overdue", "cancelled"];

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export default async function InvoicesPage({ searchParams }: PageProps<"/dashboard/invoices">) {
  const { business } = await requireUser();
  const params = await searchParams;
  const q = str(params.q);
  const statusParam = str(params.status);
  const status = STATUSES.includes(statusParam as InvoiceStatus) ? (statusParam as InvoiceStatus) : undefined;
  const clientId = str(params.client);
  const from = str(params.from);
  const to = str(params.to);
  const page = Number(str(params.page) ?? "1") || 1;

  const [result, clients] = await Promise.all([
    listInvoices(business.id, { q, status, clientId, from, to, page }),
    listClientOptions(business.id),
  ]);
  const hasFilters = !!(q || status || clientId || from || to);
  const csvHref = exportHref("/api/export/invoices", { q, status, client: clientId, from, to });

  return (
    <>
      <PageHeader title="Invoices" description="Search and filter every invoice you have issued.">
        <Button variant="outline" nativeButton={false} render={<a href={csvHref} />}>
          <Download /> Export CSV
        </Button>
        <Button nativeButton={false} render={<Link href="/dashboard/invoices/new" />}>
          <Plus /> New invoice
        </Button>
      </PageHeader>

      <form method="get" className="grid gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_160px_200px_150px_150px_auto]">
        <SearchSuggestInput kind="invoice" defaultValue={q} placeholder="Invoice number or client" />
        <SelectField name="status" defaultValue={status ?? ""} options={withAll("All statuses", INVOICE_STATUS_OPTIONS)} />
        <SelectField name="client" defaultValue={clientId ?? ""} options={withAll("All clients", clients.map((c) => ({ value: c.id, label: c.name })))} />
        <DatePicker name="from" defaultValue={from} placeholder="Issued from" allowClear />
        <DatePicker name="to" defaultValue={to} placeholder="Issued to" allowClear />
        <div className="flex gap-2">
          <Button type="submit" variant="outline" className="flex-1">
            Filter
          </Button>
          {hasFilters ? (
            <Button variant="ghost" nativeButton={false} render={<Link href="/dashboard/invoices" />}>
              Clear
            </Button>
          ) : null}
        </div>
      </form>

      <InvoicesTable invoices={result.items} hasFilters={hasFilters} />
      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        params={{ q, status, client: clientId, from, to }}
        basePath="/dashboard/invoices"
      />
    </>
  );
}
