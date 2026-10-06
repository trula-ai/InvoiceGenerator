import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { csvResponse, toCsv } from "@/lib/csv";
import { getTransactionHistory, type HistoryEntry, type HistoryEntryKind } from "@/lib/data/history";
import { todayIso } from "@/lib/fiscal-year";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/payment";

const HEADERS = ["Date", "Type", "Reference", "Related reference", "Client", "Status/Method", "Currency", "Amount", "Amount (INR)"];

function str(v: string | null): string | undefined {
  return v && v.trim() ? v.trim() : undefined;
}

/** Invoice status for invoices; human-readable payment method for payments. */
function statusOrMethod(e: HistoryEntry): string | undefined {
  if (e.kind === "invoice") return e.status;
  if (!e.method) return undefined;
  return PAYMENT_METHOD_LABELS[e.method as keyof typeof PAYMENT_METHOD_LABELS] ?? e.method;
}

/** GET /api/export/history?q=&kind=&client=&from=&to= — the transaction timeline as CSV. */
export async function GET(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const q = str(params.get("q"));
  const kindParam = str(params.get("kind"));
  const kind = kindParam === "invoice" || kindParam === "payment" ? (kindParam as HistoryEntryKind) : undefined;
  const clientId = str(params.get("client"));
  const from = str(params.get("from"));
  const to = str(params.get("to"));

  const entries = await getTransactionHistory(current.business.id, { q, kind, clientId, from, to });
  const rows = entries.map((e) => [
    e.date,
    e.kind === "payment" ? "Payment" : "Invoice",
    e.reference,
    e.relatedReference,
    e.clientName,
    statusOrMethod(e),
    e.currency,
    e.amount,
    e.amountInr,
  ]);

  return csvResponse(`history-${todayIso()}.csv`, toCsv(HEADERS, rows));
}
