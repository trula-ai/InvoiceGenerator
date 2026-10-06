/**
 * Dashboard view-model types.
 *
 * These are the contract between the data-access layer (`lib/data/dashboard.ts`)
 * and the dashboard UI components. They describe *display* shapes, not database
 * rows; the data layer maps rows into these.
 *
 * MONEY: amounts are `MoneyAmount` (number | string). PostgreSQL `numeric`
 * columns come back from Drizzle as strings so no precision is lost; the UI
 * only formats them and never does arithmetic on them.
 */

import type { InvoiceStatus } from "@/db/schema";
import type { MoneyAmount } from "@/lib/format";

export type OverviewStatKind = "revenue" | "paid" | "pending" | "overdue";

export interface OverviewStat {
  kind: OverviewStatKind;
  /** INR. */
  amount: MoneyAmount;
  /** Percentage change versus the comparison period; omitted when none exists. */
  change?: number;
  changeLabel?: string;
}

export interface RevenuePoint {
  month: string;
  invoiced: MoneyAmount;
  collected: MoneyAmount;
}

export interface RevenueSummary {
  totalInvoiced: MoneyAmount;
  totalCollected: MoneyAmount;
  change?: number;
  changeLabel?: string;
}

export interface InvoiceStats {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  draft: number;
}

export type { InvoiceStatus };

export interface RecentInvoice {
  id: string;
  number: string;
  client: string;
  /** ISO date, YYYY-MM-DD */
  issuedAt: string;
  amount: MoneyAmount;
  currency: string;
  status: InvoiceStatus;
}

export interface RecentPayment {
  id: string;
  client: string;
  invoiceNumber: string;
  amount: MoneyAmount;
  currency: string;
  /** ISO date, YYYY-MM-DD */
  paidAt: string;
  method: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  type: "b2b" | "b2c";
  email: string | null;
  currency: string;
  invoiceCount: number;
  /** INR. */
  totalInvoicedInr: MoneyAmount;
  /** INR. */
  outstandingInr: MoneyAmount;
}

export interface PaymentRecord extends RecentPayment {
  receiptNumber: string;
  invoiceId: string;
}

/** Every client, invoice and payment for the "All records" card. */
export interface RecordsOverview {
  clients: ClientRecord[];
  invoices: RecentInvoice[];
  payments: PaymentRecord[];
}

export interface DashboardData {
  /** Reporting currency for the aggregate figures (INR). */
  currency: string;
  overviewStats: OverviewStat[];
  revenueByMonth: RevenuePoint[];
  revenueSummary: RevenueSummary;
  invoiceStats: InvoiceStats;
  recentInvoices: RecentInvoice[];
  recentPayments: RecentPayment[];
  records: RecordsOverview;
}
