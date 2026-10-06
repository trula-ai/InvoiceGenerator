import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClientForm } from "@/components/clients/client-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { getClient } from "@/lib/data/clients";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: PageProps<"/dashboard/clients/[id]/edit">) {
  const { business } = await requireUser();
  const { id } = await params;
  const client = await getClient(business.id, id);
  if (!client) notFound();

  return (
    <>
      <PageHeader title={`Edit ${client.name}`} description="Update the client's contact and billing details." />
      <ClientForm
        mode="edit"
        clientId={client.id}
        defaultCurrency={business.defaultCurrency}
        defaultValues={{
          type: client.type,
          name: client.name,
          contactName: client.contactName ?? "",
          email: client.email ?? "",
          phone: client.phone ?? "",
          gstin: client.gstin ?? "",
          addressLine1: client.addressLine1 ?? "",
          addressLine2: client.addressLine2 ?? "",
          city: client.city ?? "",
          state: client.state ?? "",
          stateCode: client.stateCode ?? "",
          postalCode: client.postalCode ?? "",
          country: client.country,
          currency: client.currency,
          notes: client.notes ?? "",
          autoReminders: client.autoReminders,
        }}
      />
    </>
  );
}
