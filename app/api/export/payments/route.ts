import { NextResponse } from "next/server";

import type { PaymentMethod } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { csvResponse, toCsv } from "@/lib/csv";
import { listPayments } from "@/lib/data/payments";
import { todayIso } from "@/lib/fiscal-year";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/validation/payment";

const HEADERS = [
  "Receipt number",
  "Payment date",
  "Client",
  "Invoice number",
  "Method",
  "Currency",
  "Amount",
  "Amount (INR)",
  "Reference",
  "Notes",
];

function str(v: string | null): string | undefined {
  return v && v.trim() ? v.trim() : undefined;
}

/** GET /api/export/payments?q=&method=&from=&to= — every matching payment as CSV. */
export async function GET(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const q = str(params.get("q"));
  const methodParam = str(params.get("method"));
  const method = PAYMENT_METHODS.includes(methodParam as PaymentMethod) ? (methodParam as PaymentMethod) : undefined;
  const from = str(params.get("from"));
  const to = str(params.get("to"));

  const payments = await listPayments(current.business.id, { q, method, from, to });
  const rows = payments.map((p) => [
    p.receiptNumber,
    p.paymentDate,
    p.clientName,
    p.invoiceNumber,
    PAYMENT_METHOD_LABELS[p.method],
    p.invoiceCurrency,
    p.amount,
    p.amountInr,
    p.reference,
    p.notes,
  ]);

  return csvResponse(`payments-${todayIso()}.csv`, toCsv(HEADERS, rows));
}
