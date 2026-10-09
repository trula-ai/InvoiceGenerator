import { D, toMoney, type DecimalInput } from "@/lib/money";

/**
 * HSN/SAC-wise tax summary printed on GST invoices: for every distinct code
 * and rate, the taxable value and the tax booked against it. Lines without a
 * code are grouped under "-" so the summary always reconciles with the totals.
 */

export interface HsnSummaryLine {
  hsnSac: string | null;
  quantity: DecimalInput;
  taxRate: DecimalInput;
  taxableAmount: DecimalInput;
  taxAmount: DecimalInput;
}

export interface HsnSummaryRow {
  hsnSac: string;
  taxRate: string;
  quantity: string;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  taxAmount: string;
}

export const NO_HSN_LABEL = "-";

export function summariseByHsn(items: HsnSummaryLine[], isInterState: boolean): HsnSummaryRow[] {
  const groups = new Map<string, HsnSummaryRow>();
  for (const item of items) {
    const code = item.hsnSac?.trim() || NO_HSN_LABEL;
    const rate = D(item.taxRate).toFixed(2);
    const key = `${code}|${rate}`;
    const row = groups.get(key) ?? {
      hsnSac: code,
      taxRate: rate,
      quantity: "0",
      taxableAmount: "0",
      cgstAmount: "0",
      sgstAmount: "0",
      igstAmount: "0",
      taxAmount: "0",
    };
    const tax = D(item.taxAmount);
    row.quantity = D(row.quantity).plus(D(item.quantity)).toString();
    row.taxableAmount = toMoney(D(row.taxableAmount).plus(D(item.taxableAmount)));
    row.taxAmount = toMoney(D(row.taxAmount).plus(tax));
    if (isInterState) {
      row.igstAmount = toMoney(D(row.igstAmount).plus(tax));
    } else {
      // Per-line tax was computed as 2 x round(half), so the halves are exact.
      const half = tax.div(2);
      row.cgstAmount = toMoney(D(row.cgstAmount).plus(half));
      row.sgstAmount = toMoney(D(row.sgstAmount).plus(half));
    }
    groups.set(key, row);
  }
  return [...groups.values()].sort((a, b) => a.hsnSac.localeCompare(b.hsnSac) || Number(a.taxRate) - Number(b.taxRate));
}
