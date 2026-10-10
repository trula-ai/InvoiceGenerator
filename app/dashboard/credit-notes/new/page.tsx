import type { Metadata } from "next";

import { NewDocumentPage } from "@/components/invoices/new-document-page";

export const metadata: Metadata = { title: "New credit note" };

export default async function NewCreditNotePage({ searchParams }: PageProps<"/dashboard/credit-notes/new">) {
  return <NewDocumentPage kind="credit_note" searchParams={searchParams} />;
}
