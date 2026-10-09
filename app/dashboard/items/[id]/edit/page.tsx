import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArchiveItemButton } from "@/components/items/archive-item-button";
import { ItemForm } from "@/components/items/item-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { getItem } from "@/lib/data/items";

export const metadata: Metadata = { title: "Edit item" };

export default async function EditItemPage({ params }: PageProps<"/dashboard/items/[id]/edit">) {
  const { business } = await requireUser();
  const { id } = await params;
  const item = await getItem(business.id, id);
  if (!item) notFound();

  return (
    <>
      <PageHeader title={`Edit ${item.name}`} description={item.archivedAt ? "This item is archived and hidden from the invoice form." : "Update the defaults used when this item is added to an invoice."}>
        <ArchiveItemButton itemId={item.id} archived={!!item.archivedAt} />
      </PageHeader>
      <ItemForm
        mode="edit"
        itemId={item.id}
        gstEnabled={business.gstEnabled}
        currency={business.defaultCurrency}
        defaultValues={{
          name: item.name,
          description: item.description ?? "",
          hsnSac: item.hsnSac ?? "",
          unit: item.unit ?? "",
          unitPrice: item.unitPrice,
          taxRate: String(Number(item.taxRate)),
        }}
      />
    </>
  );
}
