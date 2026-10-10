import type { Metadata } from "next";

import { NewDocumentPage } from "@/components/invoices/new-document-page";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/dashboard/invoices/new">) {
  return <NewDocumentPage kind="invoice" searchParams={searchParams} />;
}
