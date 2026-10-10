import type { Metadata } from "next";

import { DocumentDetailPage } from "@/components/invoices/document-detail-page";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoiceDetailRoute({ params }: PageProps<"/dashboard/invoices/[id]">) {
  const { id } = await params;
  return <DocumentDetailPage kind="invoice" id={id} />;
}
