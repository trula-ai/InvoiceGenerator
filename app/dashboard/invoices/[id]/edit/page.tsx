import type { Metadata } from "next";

import { EditDocumentPage } from "@/components/invoices/edit-document-page";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: PageProps<"/dashboard/invoices/[id]/edit">) {
  const { id } = await params;
  return <EditDocumentPage kind="invoice" id={id} />;
}
