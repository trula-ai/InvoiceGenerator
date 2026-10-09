import Link from "next/link";
import { Package, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArchiveItemButton } from "@/components/items/archive-item-button";
import type { ItemListItem } from "@/lib/data/items";
import { formatCurrency } from "@/lib/format";

interface ItemsTableProps {
  items: ItemListItem[];
  hasFilters: boolean;
  gstEnabled: boolean;
  currency: string;
}

export function ItemsTable({ items, hasFilters, gstEnabled, currency }: ItemsTableProps) {
  if (items.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Package />
          </EmptyMedia>
          <EmptyTitle>{hasFilters ? "No items match your search" : "No items yet"}</EmptyTitle>
          <EmptyDescription>
            {hasFilters
              ? "Try a different name or code."
              : "Save the products and services you sell once, then pick them in the invoice form instead of retyping them."}
          </EmptyDescription>
        </EmptyHeader>
        {!hasFilters ? (
          <EmptyContent>
            <Button nativeButton={false} render={<Link href="/dashboard/items/new" />}>
              Add item
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="hidden md:table-cell">{gstEnabled ? "HSN / SAC" : "Code"}</TableHead>
            <TableHead className="hidden sm:table-cell">Unit</TableHead>
            <TableHead className="text-right">Price ({currency})</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Tax %</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Used</TableHead>
            <TableHead className="w-24 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <Link href={`/dashboard/items/${item.id}/edit`} className="font-medium hover:underline">
                  {item.name}
                </Link>
                {item.description ? <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.description}</p> : null}
                {item.archivedAt ? <p className="mt-0.5 text-xs text-muted-foreground">Archived</p> : null}
              </TableCell>
              <TableCell className="hidden font-mono text-xs md:table-cell">{item.hsnSac ?? "—"}</TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">{item.unit ?? "—"}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatCurrency(item.unitPrice, currency)}</TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">{Number(item.taxRate).toFixed(2)}%</TableCell>
              <TableCell className="hidden text-right tabular-nums text-muted-foreground lg:table-cell">{item.usageCount}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="Edit item" nativeButton={false} render={<Link href={`/dashboard/items/${item.id}/edit`} />}>
                    <Pencil />
                  </Button>
                  <ArchiveItemButton compact itemId={item.id} archived={!!item.archivedAt} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
