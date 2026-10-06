import { NextResponse } from "next/server";

import { getInvoiceDetailByToken } from "@/lib/data/invoices";
import { pdfFileName, renderInvoicePdf } from "@/lib/pdf/render";

/**
 * GET /api/public/invoices/:token/pdf?download=1
 * Public invoice PDF reached through the unguessable share token. No login;
 * the token itself is the credential, so nothing else is accepted.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const detail = await getInvoiceDetailByToken(token);
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
      "X-Robots-Tag": "noindex",
    },
  });
}
