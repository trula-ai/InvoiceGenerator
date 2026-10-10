import type { Metadata } from "next";

import { EditDocumentPage } from "@/components/invoices/edit-document-page";

export const metadata: Metadata = { title: "Edit credit note" };

export default async function EditCreditNotePage({ params }: PageProps<"/dashboard/credit-notes/[id]/edit">) {
  const { id } = await params;
  return <EditDocumentPage kind="credit_note" id={id} />;
}
