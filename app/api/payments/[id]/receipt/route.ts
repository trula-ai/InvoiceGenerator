import { NextResponse } from "next/server";

import { can, getCurrentUser } from "@/lib/auth/current-user";
import { getPaymentDetail } from "@/lib/data/payments";
import { getReceiptForPayment, receiptRelease } from "@/lib/data/receipts";
import { receiptPdfBytes } from "@/lib/email/send-receipt";
import { pdfFileName } from "@/lib/pdf/render";

/**
 * GET /api/payments/:id/receipt?download=1 — streams the frozen receipt PDF.
 * Refused (409) until the receipt is released: the payment must be verified,
 * not reversed, and the sales credit approved when the business requires it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(current, "payments.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const detail = await getPaymentDetail(current.business.id, id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const receipt = await getReceiptForPayment(current.business.id, id);
  const release = await receiptRelease(current.business, detail.payment, receipt);
  if (!release.released) return NextResponse.json({ error: release.reason }, { status: 409 });

  const file = await receiptPdfBytes(current.business.id, id);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  const fileName = pdfFileName(file.receiptNumber);

  return new NextResponse(new Uint8Array(file.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(file.pdf.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
