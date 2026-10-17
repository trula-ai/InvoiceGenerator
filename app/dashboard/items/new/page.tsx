import type { Metadata } from "next";

import { ItemForm } from "@/components/items/item-form";
import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "New item" };

export default async function NewItemPage() {
  const { business } = await requirePermission("items.manage");
  return (
    <>
      <PageHeader title="New item" description="Add a product or service to your catalog." />
      <ItemForm mode="create" gstEnabled={business.gstEnabled} currency={business.defaultCurrency} />
    </>
  );
}
