import type { Metadata } from "next";

import { DocumentListPage } from "@/components/invoices/document-list-page";

export const metadata: Metadata = { title: "Credit notes" };

export default async function CreditNotesPage({ searchParams }: PageProps<"/dashboard/credit-notes">) {
  return <DocumentListPage kind="credit_note" searchParams={searchParams} />;
}
