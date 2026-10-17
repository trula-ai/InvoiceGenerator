import { NextResponse } from "next/server";

import type { PaymentMethod, PaymentStatus } from "@/db/schema";
import { can, getCurrentUser } from "@/lib/auth/current-user";
import { csvResponse, toCsv } from "@/lib/csv";
import { listPayments } from "@/lib/data/payments";
import { todayIso } from "@/lib/fiscal-year";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/validation/payment";

const HEADERS = [
  "Receipt number",
  "Status",
  "Payment date",
  "Client",
  "Invoice number",
  "Method",
  "Currency",
  "Amount",
  "Amount (INR)",
  "Reference",
  "Notes",
  "Receiving account",
  "Recorded by",
  "Reviewed by",
  "Rejection / reversal reason",
];

function str(v: string | null): string | undefined {
  return v && v.trim() ? v.trim() : undefined;
}

/** GET /api/export/payments?q=&method=&from=&to= — every matching payment as CSV. */
export async function GET(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(current, "payments.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const q = str(params.get("q"));
  const methodParam = str(params.get("method"));
  const method = PAYMENT_METHODS.includes(methodParam as PaymentMethod) ? (methodParam as PaymentMethod) : undefined;
  const statusParam = str(params.get("status"));
  const status = PAYMENT_STATUSES.includes(statusParam as PaymentStatus) ? (statusParam as PaymentStatus) : undefined;
  const from = str(params.get("from"));
  const to = str(params.get("to"));

  const payments = await listPayments(current.business.id, { q, method, status, from, to });
  const rows = payments.map((p) => [
    p.receiptNumber,
    p.status,
    p.paymentDate,
    p.clientName,
    p.invoiceNumber,
    PAYMENT_METHOD_LABELS[p.method],
    p.invoiceCurrency,
    p.amount,
    p.amountInr,
    p.reference,
    p.notes,
    p.receivingAccount,
    p.recordedByName,
    p.reviewedByName,
    p.rejectionReason ?? p.reversalReason,
  ]);

  return csvResponse(`payments-${todayIso()}.csv`, toCsv(HEADERS, rows));
}
