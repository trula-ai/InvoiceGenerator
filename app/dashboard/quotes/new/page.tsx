import type { Metadata } from "next";

import { NewDocumentPage } from "@/components/invoices/new-document-page";

export const metadata: Metadata = { title: "New quote" };

export default async function NewQuotePage({ searchParams }: PageProps<"/dashboard/quotes/new">) {
  return <NewDocumentPage kind="quote" searchParams={searchParams} />;
}
