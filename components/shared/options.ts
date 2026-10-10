import type { DocumentKind } from "@/db/schema";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { documentStatuses, statusLabel } from "@/lib/documents";
import { INDIA_STATES } from "@/lib/india-states";
import { INVOICE_STATUS_LABELS } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/validation/payment";

/** Option lists shared by the themed Select fields. Server-safe (no client code). */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export const CURRENCY_OPTIONS: SelectOption[] = SUPPORTED_CURRENCIES.map((c) => ({
  value: c.code,
  label: `${c.code} · ${c.name}`,
}));

export const INDIA_STATE_OPTIONS: SelectOption[] = INDIA_STATES.map((s) => ({
  value: s.code,
  label: `${s.code} · ${s.name}`,
}));

export const CLIENT_TYPE_OPTIONS: SelectOption[] = [
  { value: "b2b", label: "B2B · Business" },
  { value: "b2c", label: "B2C · Individual" },
];

export const INVOICE_TYPE_OPTIONS: SelectOption[] = [
  { value: "b2b", label: "B2B · Business to business" },
  { value: "b2c", label: "B2C · Business to consumer" },
];

export const INVOICE_STATUS_OPTIONS: SelectOption[] = (
  ["draft", "pending", "partially_paid", "paid", "overdue", "cancelled"] as const
).map((s) => ({ value: s, label: INVOICE_STATUS_LABELS[s] }));

/** Status filter choices worded for a document kind. */
export function statusOptionsFor(kind: DocumentKind): SelectOption[] {
  return documentStatuses(kind).map((s) => ({ value: s, label: statusLabel(s, kind) }));
}

export const PAYMENT_METHOD_OPTIONS: SelectOption[] = PAYMENT_METHODS.map((m) => ({
  value: m,
  label: PAYMENT_METHOD_LABELS[m],
}));

export const DISCOUNT_TYPE_OPTIONS: SelectOption[] = [
  { value: "none", label: "None" },
  { value: "percent", label: "Percentage" },
  { value: "fixed", label: "Fixed amount" },
];

/** Prepends an "any" choice (value "") used by filter forms. */
export function withAll(label: string, options: SelectOption[]): SelectOption[] {
  return [{ value: "", label }, ...options];
}
