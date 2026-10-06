import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { clients, invoices, payments } from "@/db/schema";
import { BASE_CURRENCY } from "@/lib/currency";
import { db } from "@/lib/db";
import { D, toMoney } from "@/lib/money";
import type {
  DashboardData,
  InvoiceStats,
  OverviewStat,
  PaymentRecord,
  RecentInvoice,
  RecordsOverview,
  RevenuePoint,
  RevenueSummary,
} from "@/lib/types/dashboard";

import { listClients } from "./clients";
import { syncOverdueStatuses } from "./invoices";

/**
 * Dashboard data access. SERVER ONLY. All amounts are normalised to INR using
 * the exchange rate frozen on each invoice, so figures are stable over time.
 */

const ISSUED = inArray(invoices.status, ["pending", "partially_paid", "paid", "overdue"]);
const UNPAID = inArray(invoices.status, ["pending", "partially_paid", "overdue"]);

/** Inclusive ISO date range for a calendar month offset from the current one. */
function monthRange(offset: number, now = new Date()): { from: string; to: string; label: string; key: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  const label = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(start);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    label,
    key: start.toISOString().slice(0, 7),
  };
}

function percentChange(current: string, previous: string): number | undefined {
  const prev = D(previous);
  if (prev.isZero()) return undefined;
  return D(current).minus(prev).div(prev).times(100).toDecimalPlaces(1).toNumber();
}

export async function getOverviewStats(businessId: string): Promise<OverviewStat[]> {
  const thisMonth = monthRange(0);
  const lastMonth = monthRange(-1);

  const [totals] = await db
    .select({
      revenue: sql<string>`coalesce(sum(${invoices.totalInr}), 0)::text`,
      pending: sql<string>`coalesce(sum(${invoices.balanceDue} * ${invoices.exchangeRate}) filter (where ${invoices.status} in ('pending','partially_paid')), 0)::numeric(14,2)::text`,
      overdue: sql<string>`coalesce(sum(${invoices.balanceDue} * ${invoices.exchangeRate}) filter (where ${invoices.status} = 'overdue'), 0)::numeric(14,2)::text`,
      revenueThisMonth: sql<string>`coalesce(sum(${invoices.totalInr}) filter (where ${invoices.issueDate} between ${thisMonth.from} and ${thisMonth.to}), 0)::text`,
      revenueLastMonth: sql<string>`coalesce(sum(${invoices.totalInr}) filter (where ${invoices.issueDate} between ${lastMonth.from} and ${lastMonth.to}), 0)::text`,
    })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), ISSUED));

  const [paid] = await db
    .select({
      total: sql<string>`coalesce(sum(${payments.amountInr}), 0)::text`,
      thisMonth: sql<string>`coalesce(sum(${payments.amountInr}) filter (where ${payments.paymentDate} between ${thisMonth.from} and ${thisMonth.to}), 0)::text`,
      lastMonth: sql<string>`coalesce(sum(${payments.amountInr}) filter (where ${payments.paymentDate} between ${lastMonth.from} and ${lastMonth.to}), 0)::text`,
    })
    .from(payments)
    .where(eq(payments.businessId, businessId));

  return [
    {
      kind: "revenue",
      amount: totals?.revenue ?? "0",
      change: percentChange(totals?.revenueThisMonth ?? "0", totals?.revenueLastMonth ?? "0"),
      changeLabel: "vs last month",
    },
    {
      kind: "paid",
      amount: paid?.total ?? "0",
      change: percentChange(paid?.thisMonth ?? "0", paid?.lastMonth ?? "0"),
      changeLabel: "vs last month",
    },
    { kind: "pending", amount: totals?.pending ?? "0" },
    { kind: "overdue", amount: totals?.overdue ?? "0" },
  ];
}

export async function getRevenueByMonth(businessId: string): Promise<{ points: RevenuePoint[]; summary: RevenueSummary }> {
  const months = Array.from({ length: 12 }, (_, i) => monthRange(i - 11));
  const from = months[0].from;
  const to = months[months.length - 1].to;

  const invoiced = await db
    .select({
      key: sql<string>`to_char(${invoices.issueDate}, 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${invoices.totalInr}), 0)::text`,
    })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), ISSUED, gte(invoices.issueDate, from), lte(invoices.issueDate, to)))
    .groupBy(sql`to_char(${invoices.issueDate}, 'YYYY-MM')`);

  const collected = await db
    .select({
      key: sql<string>`to_char(${payments.paymentDate}, 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${payments.amountInr}), 0)::text`,
    })
    .from(payments)
    .where(and(eq(payments.businessId, businessId), gte(payments.paymentDate, from), lte(payments.paymentDate, to)))
    .groupBy(sql`to_char(${payments.paymentDate}, 'YYYY-MM')`);

  const invoicedMap = new Map(invoiced.map((r) => [r.key, r.total]));
  const collectedMap = new Map(collected.map((r) => [r.key, r.total]));

  const points: RevenuePoint[] = months.map((m) => ({
    month: m.label,
    invoiced: invoicedMap.get(m.key) ?? "0",
    collected: collectedMap.get(m.key) ?? "0",
  }));

  const totalInvoiced = toMoney(points.reduce((acc, p) => acc.plus(D(p.invoiced)), D(0)));
  const totalCollected = toMoney(points.reduce((acc, p) => acc.plus(D(p.collected)), D(0)));

  return { points, summary: { totalInvoiced, totalCollected } };
}

export async function getInvoiceStats(businessId: string): Promise<InvoiceStats> {
  const rows = await db
    .select({ status: invoices.status, count: sql<number>`count(*)`.mapWith(Number) })
    .from(invoices)
    .where(eq(invoices.businessId, businessId))
    .groupBy(invoices.status);

  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.count])) as Partial<Record<string, number>>;
  const paid = byStatus.paid ?? 0;
  const pending = (byStatus.pending ?? 0) + (byStatus.partially_paid ?? 0);
  const overdue = byStatus.overdue ?? 0;
  const draft = byStatus.draft ?? 0;
  return { total: paid + pending + overdue + draft, paid, pending, overdue, draft };
}

/** Newest invoices first. Omit `limit` to fetch every invoice. */
export async function getRecentInvoices(businessId: string, limit?: number): Promise<RecentInvoice[]> {
  const query = db
    .select({
      id: invoices.id,
      number: invoices.invoiceNumber,
      client: clients.name,
      issuedAt: invoices.issueDate,
      amount: invoices.total,
      currency: invoices.currency,
      status: invoices.status,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(eq(invoices.businessId, businessId))
    .orderBy(desc(invoices.createdAt))
    .$dynamic();
  const rows = await (limit ? query.limit(limit) : query);

  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    client: r.client,
    issuedAt: r.issuedAt,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
  }));
}

/** Newest payments first. Omit `limit` to fetch every payment. */
export async function getRecentPayments(businessId: string, limit?: number): Promise<PaymentRecord[]> {
  const query = db
    .select({
      id: payments.id,
      receiptNumber: payments.receiptNumber,
      invoiceId: payments.invoiceId,
      client: clients.name,
      invoiceNumber: invoices.invoiceNumber,
      amount: payments.amount,
      currency: invoices.currency,
      paidAt: payments.paymentDate,
      method: payments.method,
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(eq(payments.businessId, businessId))
    .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
    .$dynamic();
  const rows = await (limit ? query.limit(limit) : query);

  return rows.map((r) => ({ ...r }));
}

/** Every active client, invoice and payment for the business. */
export async function getRecordsOverview(businessId: string): Promise<RecordsOverview> {
  const [clientRows, invoiceRows, paymentRows] = await Promise.all([
    listClients(businessId),
    getRecentInvoices(businessId),
    getRecentPayments(businessId),
  ]);

  return {
    clients: clientRows.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      email: c.email,
      currency: c.currency,
      invoiceCount: c.invoiceCount,
      totalInvoicedInr: c.totalInvoicedInr,
      outstandingInr: c.outstandingInr,
    })),
    invoices: invoiceRows,
    payments: paymentRows,
  };
}

export async function getPendingInvoiceCount(businessId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), UNPAID));
  return row?.count ?? 0;
}

export async function getDashboardData(businessId: string): Promise<DashboardData> {
  await syncOverdueStatuses(businessId);

  const [overviewStats, revenue, invoiceStats, recentInvoices, recentPayments, records] = await Promise.all([
    getOverviewStats(businessId),
    getRevenueByMonth(businessId),
    getInvoiceStats(businessId),
    getRecentInvoices(businessId, 6),
    getRecentPayments(businessId, 5),
    getRecordsOverview(businessId),
  ]);

  return {
    currency: BASE_CURRENCY,
    overviewStats,
    revenueByMonth: revenue.points,
    revenueSummary: revenue.summary,
    invoiceStats,
    recentInvoices,
    recentPayments,
    records,
  };
}
