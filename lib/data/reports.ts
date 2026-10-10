import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { clients, invoices, payments } from "@/db/schema";
import { db } from "@/lib/db";
import { financialYearRange, currentFinancialYear } from "@/lib/fiscal-year";
import { D, toMoney } from "@/lib/money";

import { syncOverdueStatuses } from "./invoices";

/**
 * Reports. All totals are in INR using each invoice's frozen exchange rate.
 * A report always covers an inclusive issue-date range; the default range is
 * the current Indian financial year.
 */

export interface ReportRange {
  from: string;
  to: string;
}

export interface ReportSummary {
  range: ReportRange;
  /** Issued invoices net of issued credit notes. */
  invoicedInr: string;
  /** Total of credit notes issued in the range. */
  creditedInr: string;
  creditNoteCount: number;
  collectedInr: string;
  outstandingInr: string;
  overdueInr: string;
  taxInr: string;
  invoiceCount: number;
  paidCount: number;
  averageInvoiceInr: string;
}

export interface ClientRevenueRow {
  clientId: string;
  clientName: string;
  invoiceCount: number;
  invoicedInr: string;
  outstandingInr: string;
}

export interface CurrencyRow {
  currency: string;
  invoiceCount: number;
  total: string;
  totalInr: string;
}

export interface StatusRow {
  status: string;
  count: number;
  totalInr: string;
}

export interface MonthRow {
  key: string;
  label: string;
  invoicedInr: string;
  collectedInr: string;
}

const IS_INVOICE = eq(invoices.documentKind, "invoice");
const ISSUED = and(IS_INVOICE, inArray(invoices.status, ["pending", "partially_paid", "paid", "overdue"]))!;
/** Issued credit notes, subtracted from invoiced totals so revenue is net of credits. */
const ISSUED_CREDIT = and(eq(invoices.documentKind, "credit_note"), eq(invoices.status, "pending"))!;

export function defaultReportRange(): ReportRange {
  return financialYearRange(currentFinancialYear());
}

export async function getReportSummary(businessId: string, range: ReportRange): Promise<ReportSummary> {
  await syncOverdueStatuses(businessId);
  const inRange = and(eq(invoices.businessId, businessId), ISSUED, gte(invoices.issueDate, range.from), lte(invoices.issueDate, range.to));

  const [inv] = await db
    .select({
      invoiced: sql<string>`coalesce(sum(${invoices.totalInr}), 0)::text`,
      outstanding: sql<string>`coalesce(sum(${invoices.balanceDue} * ${invoices.exchangeRate}) filter (where ${invoices.status} in ('pending','partially_paid','overdue')), 0)::numeric(14,2)::text`,
      overdue: sql<string>`coalesce(sum(${invoices.balanceDue} * ${invoices.exchangeRate}) filter (where ${invoices.status} = 'overdue'), 0)::numeric(14,2)::text`,
      tax: sql<string>`coalesce(sum(${invoices.taxAmount} * ${invoices.exchangeRate}), 0)::numeric(14,2)::text`,
      count: sql<number>`count(*)`.mapWith(Number),
      paidCount: sql<number>`count(*) filter (where ${invoices.status} = 'paid')`.mapWith(Number),
      average: sql<string>`coalesce(avg(${invoices.totalInr}), 0)::numeric(14,2)::text`,
    })
    .from(invoices)
    .where(inRange);

  const [pay] = await db
    .select({ collected: sql<string>`coalesce(sum(${payments.amountInr}), 0)::text` })
    .from(payments)
    .where(and(eq(payments.businessId, businessId), gte(payments.paymentDate, range.from), lte(payments.paymentDate, range.to)));

  const [credit] = await db
    .select({
      total: sql<string>`coalesce(sum(${invoices.totalInr}), 0)::text`,
      tax: sql<string>`coalesce(sum(${invoices.taxAmount} * ${invoices.exchangeRate}), 0)::numeric(14,2)::text`,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), ISSUED_CREDIT, gte(invoices.issueDate, range.from), lte(invoices.issueDate, range.to)));

  return {
    range,
    invoicedInr: toMoney(D(inv?.invoiced ?? 0).minus(D(credit?.total ?? 0))),
    creditedInr: credit?.total ?? "0",
    creditNoteCount: credit?.count ?? 0,
    collectedInr: pay?.collected ?? "0",
    outstandingInr: inv?.outstanding ?? "0",
    overdueInr: inv?.overdue ?? "0",
    taxInr: toMoney(D(inv?.tax ?? 0).minus(D(credit?.tax ?? 0))),
    invoiceCount: inv?.count ?? 0,
    paidCount: inv?.paidCount ?? 0,
    averageInvoiceInr: inv?.average ?? "0",
  };
}

export async function getRevenueByClient(businessId: string, range: ReportRange, limit = 10): Promise<ClientRevenueRow[]> {
  return db
    .select({
      clientId: clients.id,
      clientName: clients.name,
      invoiceCount: sql<number>`count(${invoices.id})`.mapWith(Number),
      invoicedInr: sql<string>`coalesce(sum(${invoices.totalInr}), 0)::text`,
      outstandingInr: sql<string>`coalesce(sum(${invoices.balanceDue} * ${invoices.exchangeRate}) filter (where ${invoices.status} in ('pending','partially_paid','overdue')), 0)::numeric(14,2)::text`,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.businessId, businessId), ISSUED, gte(invoices.issueDate, range.from), lte(invoices.issueDate, range.to)))
    .groupBy(clients.id, clients.name)
    .orderBy(desc(sql`sum(${invoices.totalInr})`))
    .limit(limit);
}

export async function getRevenueByCurrency(businessId: string, range: ReportRange): Promise<CurrencyRow[]> {
  return db
    .select({
      currency: invoices.currency,
      invoiceCount: sql<number>`count(*)`.mapWith(Number),
      total: sql<string>`coalesce(sum(${invoices.total}), 0)::text`,
      totalInr: sql<string>`coalesce(sum(${invoices.totalInr}), 0)::text`,
    })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), ISSUED, gte(invoices.issueDate, range.from), lte(invoices.issueDate, range.to)))
    .groupBy(invoices.currency)
    .orderBy(desc(sql`sum(${invoices.totalInr})`));
}

export async function getStatusBreakdown(businessId: string, range: ReportRange): Promise<StatusRow[]> {
  return db
    .select({
      status: invoices.status,
      count: sql<number>`count(*)`.mapWith(Number),
      totalInr: sql<string>`coalesce(sum(${invoices.totalInr}), 0)::text`,
    })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), IS_INVOICE, gte(invoices.issueDate, range.from), lte(invoices.issueDate, range.to)))
    .groupBy(invoices.status);
}

export async function getMonthlyBreakdown(businessId: string, range: ReportRange): Promise<MonthRow[]> {
  const invoiced = await db
    .select({
      key: sql<string>`to_char(${invoices.issueDate}, 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${invoices.totalInr}), 0)::text`,
    })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), ISSUED, gte(invoices.issueDate, range.from), lte(invoices.issueDate, range.to)))
    .groupBy(sql`to_char(${invoices.issueDate}, 'YYYY-MM')`);

  const collected = await db
    .select({
      key: sql<string>`to_char(${payments.paymentDate}, 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${payments.amountInr}), 0)::text`,
    })
    .from(payments)
    .where(and(eq(payments.businessId, businessId), gte(payments.paymentDate, range.from), lte(payments.paymentDate, range.to)))
    .groupBy(sql`to_char(${payments.paymentDate}, 'YYYY-MM')`);

  const invoicedMap = new Map(invoiced.map((r) => [r.key, r.total]));
  const collectedMap = new Map(collected.map((r) => [r.key, r.total]));

  // Enumerate every month in the range so gaps show as zero rows.
  const rows: MonthRow[] = [];
  const [fy, fm] = range.from.split("-").map(Number);
  const [ty, tm] = range.to.split("-").map(Number);
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    const key = `${y}-${m.toString().padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(y, m - 1, 1)),
    );
    rows.push({ key, label, invoicedInr: invoicedMap.get(key) ?? "0", collectedInr: collectedMap.get(key) ?? "0" });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (rows.length > 120) break;
  }
  return rows;
}
