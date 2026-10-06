import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { csvResponse, toCsv } from "@/lib/csv";
import { listClients } from "@/lib/data/clients";
import { todayIso } from "@/lib/fiscal-year";

const HEADERS = [
  "Name",
  "Type",
  "Contact name",
  "Email",
  "Phone",
  "GSTIN",
  "Address line 1",
  "Address line 2",
  "City",
  "State",
  "State code",
  "Postal code",
  "Country",
  "Currency",
  "Invoices",
  "Invoiced (INR)",
  "Outstanding (INR)",
  "Archived",
  "Notes",
];

function str(v: string | null): string | undefined {
  return v && v.trim() ? v.trim() : undefined;
}

/** GET /api/export/clients?q=&type=&archived=1 — every matching client as CSV. */
export async function GET(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const q = str(params.get("q"));
  const type = str(params.get("type"));
  const archived = str(params.get("archived")) === "1";

  const clients = await listClients(current.business.id, {
    q,
    type: type === "b2b" || type === "b2c" ? type : undefined,
    includeArchived: archived,
  });
  const rows = clients.map((c) => [
    c.name,
    c.type,
    c.contactName,
    c.email,
    c.phone,
    c.gstin,
    c.addressLine1,
    c.addressLine2,
    c.city,
    c.state,
    c.stateCode,
    c.postalCode,
    c.country,
    c.currency,
    c.invoiceCount,
    c.totalInvoicedInr,
    c.outstandingInr,
    c.archivedAt ? "yes" : "no",
    c.notes,
  ]);

  return csvResponse(`clients-${todayIso()}.csv`, toCsv(HEADERS, rows));
}
