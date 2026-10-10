import type { Metadata } from "next";

import { DocumentDetailPage } from "@/components/invoices/document-detail-page";

export const metadata: Metadata = { title: "Quote" };

export default async function QuoteDetailRoute({ params }: PageProps<"/dashboard/quotes/[id]">) {
  const { id } = await params;
  return <DocumentDetailPage kind="quote" id={id} />;
}
