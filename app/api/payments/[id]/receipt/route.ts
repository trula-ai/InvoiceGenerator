import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getPaymentDetail } from "@/lib/data/payments";
import { pdfFileName, renderReceiptPdf } from "@/lib/pdf/render";

/** GET /api/payments/:id/receipt?download=1 — streams the payment receipt PDF. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const detail = await getPaymentDetail(current.business.id, id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await renderReceiptPdf(detail);
  const download = new URL(request.url).searchParams.get("download") === "1";
  const fileName = pdfFileName(detail.payment.receiptNumber);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
