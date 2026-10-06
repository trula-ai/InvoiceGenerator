import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getInvoiceDetail } from "@/lib/data/invoices";
import { pdfFileName, renderInvoicePdf } from "@/lib/pdf/render";

/** GET /api/invoices/:id/pdf?download=1 — streams the invoice PDF. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const detail = await getInvoiceDetail(current.business.id, id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await renderInvoicePdf(detail);
  const download = new URL(request.url).searchParams.get("download") === "1";
  const fileName = pdfFileName(detail.invoice.invoiceNumber);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
