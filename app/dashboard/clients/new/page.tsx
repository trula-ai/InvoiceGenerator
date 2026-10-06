import type { Metadata } from "next";

import { ClientForm } from "@/components/clients/client-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  const { business } = await requireUser();
  return (
    <>
      <PageHeader title="New client" description="Add a business or individual you want to invoice." />
      <ClientForm mode="create" defaultCurrency={business.defaultCurrency} />
    </>
  );
}
