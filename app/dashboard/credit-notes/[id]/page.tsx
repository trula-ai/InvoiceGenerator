import type { Metadata } from "next";

import { DocumentDetailPage } from "@/components/invoices/document-detail-page";

export const metadata: Metadata = { title: "Credit note" };

export default async function CreditNoteDetailRoute({ params }: PageProps<"/dashboard/credit-notes/[id]">) {
  const { id } = await params;
  return <DocumentDetailPage kind="credit_note" id={id} />;
}
