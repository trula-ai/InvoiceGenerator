import type { Metadata } from "next";

import { DocumentListPage } from "@/components/invoices/document-list-page";

export const metadata: Metadata = { title: "Quotes" };

export default async function QuotesPage({ searchParams }: PageProps<"/dashboard/quotes">) {
  return <DocumentListPage kind="quote" searchParams={searchParams} />;
}
