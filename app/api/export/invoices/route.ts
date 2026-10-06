import { NextResponse } from "next/server";

import type { InvoiceStatus } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { csvResponse, toCsv, type CsvValue } from "@/lib/csv";
import { listInvoices, type InvoiceListItem } from "@/lib/data/invoices";
import { todayIso } from "@/lib/fiscal-year";

const STATUSES: InvoiceStatus[] = ["draft", "pending", "partially_paid", "paid", "overdue", "cancelled"];
/** `listInvoices` caps `pageSize` at 100, so this is the largest page we can request. */
const PAGE_SIZE = 100;

const HEADERS = [
  "Invoice number",
  "Status",
  "Type",
  "Client",
  "Issue date",
  "Due date",
  "Currency",
  "Total",
  "Amount paid",
  "Balance due",
  "Total (INR)",
];

function str(v: string | null): string | undefined {
  return v && v.trim() ? v.trim() : undefined;
}

function toRow(i: InvoiceListItem): CsvValue[] {
  return [
    i.invoiceNumber,
    i.status,
    i.invoiceType,
    i.clientName,
    i.issueDate,
    i.dueDate,
    i.currency,
    i.total,
    i.amountPaid,
    i.balanceDue,
    i.totalInr,
  ];
}

/** GET /api/export/invoices?q=&status=&client=&from=&to= — every matching invoice as CSV. */
export async function GET(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const q = str(params.get("q"));
  const statusParam = str(params.get("status"));
  const status = STATUSES.includes(statusParam as InvoiceStatus) ? (statusParam as InvoiceStatus) : undefined;
  const clientId = str(params.get("client"));
  const from = str(params.get("from"));
  const to = str(params.get("to"));

  const rows: CsvValue[][] = [];
  for (let page = 1; ; page++) {
    const result = await listInvoices(current.business.id, { q, status, clientId, from, to, page, pageSize: PAGE_SIZE });
    rows.push(...result.items.map(toRow));
    if (result.items.length < result.pageSize || rows.length >= result.total) break;
  }

  return csvResponse(`invoices-${todayIso()}.csv`, toCsv(HEADERS, rows));
}
