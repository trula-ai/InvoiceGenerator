import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CLIENT_TYPE_OPTIONS, withAll } from "@/components/shared/options";
import { SelectField } from "@/components/shared/select-field";
import { SearchSuggestInput } from "@/components/shared/search-suggest";
import { ClientsTable } from "@/components/clients/clients-table";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { exportHref } from "@/lib/csv";
import { listClients } from "@/lib/data/clients";
import { isEmailConfigured } from "@/lib/email/provider";

export const metadata: Metadata = { title: "Clients" };

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export default async function ClientsPage({ searchParams }: PageProps<"/dashboard/clients">) {
  const { business } = await requireUser();
  const params = await searchParams;
  const q = str(params.q);
  const type = str(params.type);
  const archived = str(params.archived) === "1";

  const clients = await listClients(business.id, {
    q,
    type: type === "b2b" || type === "b2c" ? type : undefined,
    includeArchived: archived,
  });
  const csvHref = exportHref("/api/export/clients", { q, type, archived: archived ? "1" : undefined });

  return (
    <>
      <PageHeader title="Clients" description="Manage the people and businesses you invoice.">
        <Button variant="outline" nativeButton={false} render={<a href={csvHref} />}>
          <Download /> Export CSV
        </Button>
        <Button nativeButton={false} render={<Link href="/dashboard/clients/new" />}>
          <Plus /> Add client
        </Button>
      </PageHeader>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <SearchSuggestInput kind="client" defaultValue={q} placeholder="Search by name, email, phone or GSTIN" className="min-w-60 flex-1 sm:max-w-sm" />
        <SelectField name="type" defaultValue={type ?? ""} options={withAll("All types", CLIENT_TYPE_OPTIONS)} className="w-44" />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived} className="size-4 accent-primary" />
          Show archived
        </label>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {q || type || archived ? (
          <Button variant="ghost" nativeButton={false} render={<Link href="/dashboard/clients" />}>
            Clear
          </Button>
        ) : null}
      </form>

      <ClientsTable clients={clients} hasFilters={!!(q || type)} emailConfigured={isEmailConfigured()} />
    </>
  );
}
