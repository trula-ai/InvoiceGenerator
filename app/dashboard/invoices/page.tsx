import type { Metadata } from "next";

import { DocumentListPage } from "@/components/invoices/document-list-page";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: PageProps<"/dashboard/invoices">) {
  return <DocumentListPage kind="invoice" searchParams={searchParams} />;
}
