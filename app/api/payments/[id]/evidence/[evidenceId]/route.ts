import { NextResponse } from "next/server";

import { can, getCurrentUser } from "@/lib/auth/current-user";
import { getPaymentEvidenceFile } from "@/lib/data/payments";

/**
 * GET /api/payments/:id/evidence/:evidenceId
 *
 * Streams one proof file. Evidence lives in the database and is only ever
 * served through this signed-in, business-scoped route; there are no public
 * file URLs.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; evidenceId: string }> }) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(current, "payments.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, evidenceId } = await params;
  const file = await getPaymentEvidenceFile(current.business.id, id, evidenceId);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const safeName = file.fileName.replace(/[^A-Za-z0-9._-]+/g, "-");
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
