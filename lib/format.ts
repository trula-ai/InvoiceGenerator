/**
 * Display-only formatting helpers (Intl based, deterministic across server
 * and client so they are safe to use in Server Components).
 *
 * These are presentation utilities, not business logic. Money arithmetic lives
 * in `lib/money.ts`; amounts arrive here as strings (PostgreSQL numeric) or
 * numbers and are only ever formatted.
 */

import { getCurrency } from "@/lib/currency";

export type MoneyAmount = number | string;

export function formatCurrency(amount: MoneyAmount, currency = "INR", options?: Intl.NumberFormatOptions): string {
  const def = getCurrency(currency);
  return new Intl.NumberFormat(def.locale, {
    style: "currency",
    currency,
    ...options,
  }).format(Number(amount));
}

export function formatCompactCurrency(amount: MoneyAmount, currency = "INR"): string {
  return formatCurrency(amount, currency, { notation: "compact", maximumFractionDigits: 1 });
}

/** Plain number with 2 decimals and thousands separators, no symbol. */
export function formatAmount(amount: MoneyAmount, currency = "INR"): string {
  const def = getCurrency(currency);
  return new Intl.NumberFormat(def.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount));
}

/** "INR 1,234.00": symbol-free form safe for PDF fonts without the ₹ glyph. */
export function formatCurrencyCode(amount: MoneyAmount, currency = "INR"): string {
  return `${currency} ${formatAmount(amount, currency)}`;
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(fractionDigits)}%`;
}

export function formatRate(rate: MoneyAmount): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 4 }).format(Number(rate));
}

/** Formats an ISO date (YYYY-MM-DD) or Date as e.g. "28 Sep 2026". */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: typeof value === "string" ? "UTC" : undefined,
  }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};
