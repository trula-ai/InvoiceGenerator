import Link from "next/link";
import { Download, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/shared/date-picker";
import { statusOptionsFor, withAll } from "@/components/shared/options";
import { SelectField } from "@/components/shared/select-field";
import { SearchSuggestInput } from "@/components/shared/search-suggest";
import { InvoicesTable } from "@/components/invoices/invoices-table";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import type { DocumentKind, InvoiceStatus } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { exportHref } from "@/lib/csv";
import { listClientOptions } from "@/lib/data/clients";
import { listInvoices } from "@/lib/data/invoices";
import { documentBasePath, documentLabel, documentLabelPlural, documentStatuses } from "@/lib/documents";

const COPY: Record<DocumentKind, string> = {
  invoice: "Search and filter every invoice you have issued.",
  quote: "Estimates sent to clients. Accepted quotes convert to invoices in one click.",
  credit_note: "Credits issued against invoices. An issued credit note reduces the balance of its invoice.",
};

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

type SearchParams = Record<string, string | string[] | undefined>;

/** Shared list page for invoices, quotes and credit notes. */
export async function DocumentListPage({ kind, searchParams }: { kind: DocumentKind; searchParams: Promise<SearchParams> }) {
  const { business } = await requireUser();
  const params = await searchParams;
  const statuses = documentStatuses(kind);
  const q = str(params.q);
  const statusParam = str(params.status);
  const status = statuses.includes(statusParam as InvoiceStatus) ? (statusParam as InvoiceStatus) : undefined;
  const clientId = str(params.client);
  const from = str(params.from);
  const to = str(params.to);
  const page = Number(str(params.page) ?? "1") || 1;
  const basePath = documentBasePath(kind);
  const label = documentLabel(kind);

  const [result, clients] = await Promise.all([
    listInvoices(business.id, { kind, q, status, clientId, from, to, page }),
    listClientOptions(business.id),
  ]);
  const hasFilters = !!(q || status || clientId || from || to);
  const csvHref = exportHref("/api/export/invoices", { q, status, client: clientId, from, to });

  return (
    <>
      <PageHeader title={documentLabelPlural(kind)} description={COPY[kind]}>
        {kind === "invoice" ? (
          <Button variant="outline" nativeButton={false} render={<a href={csvHref} />}>
            <Download /> Export CSV
          </Button>
        ) : null}
        {kind === "credit_note" ? (
          <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/invoices" />}>
            Open an invoice to credit
          </Button>
        ) : (
          <Button nativeButton={false} render={<Link href={`${basePath}/new`} />}>
            <Plus /> New {label.toLowerCase()}
          </Button>
        )}
      </PageHeader>

      <form method="get" className="grid gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_160px_200px_150px_150px_auto]">
        <SearchSuggestInput kind="invoice" defaultValue={q} placeholder={`${label} number or client`} />
        <SelectField name="status" defaultValue={status ?? ""} options={withAll("All statuses", statusOptionsFor(kind))} />
        <SelectField name="client" defaultValue={clientId ?? ""} options={withAll("All clients", clients.map((c) => ({ value: c.id, label: c.name })))} />
        <DatePicker name="from" defaultValue={from} placeholder="Issued from" allowClear />
        <DatePicker name="to" defaultValue={to} placeholder="Issued to" allowClear />
        <div className="flex gap-2">
          <Button type="submit" variant="outline" className="flex-1">
            Filter
          </Button>
          {hasFilters ? (
            <Button variant="ghost" nativeButton={false} render={<Link href={basePath} />}>
              Clear
            </Button>
          ) : null}
        </div>
      </form>

      <InvoicesTable invoices={result.items} hasFilters={hasFilters} kind={kind} />
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} params={{ q, status, client: clientId, from, to }} basePath={basePath} />
    </>
  );
}
