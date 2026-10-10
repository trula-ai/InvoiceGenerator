import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemsTable } from "@/components/items/items-table";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { listItems } from "@/lib/data/items";

export const metadata: Metadata = { title: "Items" };

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export default async function ItemsPage({ searchParams }: PageProps<"/dashboard/items">) {
  const { business } = await requireUser();
  const params = await searchParams;
  const q = str(params.q);
  const archived = str(params.archived) === "1";

  const items = await listItems(business.id, { q, includeArchived: archived });

  return (
    <>
      <PageHeader title="Items" description="Products and services you sell, ready to drop onto an invoice.">
        <Button nativeButton={false} render={<Link href="/dashboard/items/new" />}>
          <Plus /> Add item
        </Button>
      </PageHeader>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" name="q" defaultValue={q} placeholder={business.gstEnabled ? "Search by name, description or HSN/SAC" : "Search by name or code"} className="pl-8" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived} className="size-4 accent-primary" />
          Show archived
        </label>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {q || archived ? (
          <Button variant="ghost" nativeButton={false} render={<Link href="/dashboard/items" />}>
            Clear
          </Button>
        ) : null}
      </form>

      <ItemsTable items={items} hasFilters={!!q} gstEnabled={business.gstEnabled} currency={business.defaultCurrency} />
    </>
  );
}
