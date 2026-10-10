import type { Metadata } from "next";

import { EditDocumentPage } from "@/components/invoices/edit-document-page";

export const metadata: Metadata = { title: "Edit quote" };

export default async function EditQuotePage({ params }: PageProps<"/dashboard/quotes/[id]/edit">) {
  const { id } = await params;
  return <EditDocumentPage kind="quote" id={id} />;
}
