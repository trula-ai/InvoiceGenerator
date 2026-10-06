import { D, Decimal, toMoney, type DecimalInput } from "@/lib/money";

/**
 * Invoice calculations.
 *
 * Pure and deterministic: the same function runs in the invoice form (live
 * totals) and in the Server Action (persisted totals), so what the user sees
 * is exactly what is stored.
 *
 * Tax model
 * --------
 * Each line carries its own tax rate. The invoice-level discount is allocated
 * across lines in proportion to their subtotal, tax is computed on the
 * discounted (taxable) amount of each line, and totals are sums of the
 * already-rounded line values so the document always adds up.
 *
 * When `gstEnabled` is true the per-line tax is split into CGST + SGST
 * (intra-state) or booked entirely as IGST (inter-state). When it is false the
 * tax is kept as a single "tax" figure, which supports VAT-style or no-tax
 * businesses without any India-specific behaviour.
 */

export type DiscountType = "none" | "percent" | "fixed";

export interface CalculationItemInput {
  quantity: DecimalInput;
  unitPrice: DecimalInput;
  /** Percentage, e.g. 18 for 18%. */
  taxRate: DecimalInput;
}

export interface CalculationInput {
  items: CalculationItemInput[];
  discountType: DiscountType;
  /** Percent (0-100) for `percent`, absolute amount for `fixed`, ignored for `none`. */
  discountValue: DecimalInput;
  gstEnabled: boolean;
  /** Only meaningful when gstEnabled. */
  isInterState: boolean;
  /** INR per 1 unit of the invoice currency. Use 1 for INR invoices. */
  exchangeRate: DecimalInput;
}

export interface CalculationItemResult {
  lineSubtotal: string;
  discountAmount: string;
  taxableAmount: string;
  taxAmount: string;
  lineTotal: string;
}

export interface CalculationResult {
  items: CalculationItemResult[];
  subtotal: string;
  discountAmount: string;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  taxAmount: string;
  total: string;
  totalInr: string;
}

const ZERO = new Decimal(0);

function round2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function calculateInvoice(input: CalculationInput): CalculationResult {
  const lineSubtotals = input.items.map((item) => round2(D(item.quantity).times(D(item.unitPrice))));
  const subtotal = lineSubtotals.reduce((acc, v) => acc.plus(v), ZERO);

  // --- Invoice-level discount --------------------------------------------
  let discountTotal = ZERO;
  if (input.discountType === "percent") {
    discountTotal = round2(subtotal.times(D(input.discountValue)).div(100));
  } else if (input.discountType === "fixed") {
    discountTotal = round2(D(input.discountValue));
  }
  if (discountTotal.lessThan(0)) discountTotal = ZERO;
  if (discountTotal.greaterThan(subtotal)) discountTotal = subtotal;

  // Allocate the discount proportionally; push any rounding residual onto the
  // last non-zero line so the allocated parts sum exactly to the total.
  const allocations: Decimal[] = lineSubtotals.map((ls) =>
    subtotal.isZero() ? ZERO : round2(discountTotal.times(ls).div(subtotal)),
  );
  const allocated = allocations.reduce((acc, v) => acc.plus(v), ZERO);
  const residual = discountTotal.minus(allocated);
  if (!residual.isZero()) {
    for (let i = allocations.length - 1; i >= 0; i -= 1) {
      if (!lineSubtotals[i].isZero()) {
        allocations[i] = allocations[i].plus(residual);
        break;
      }
    }
  }

  // --- Per-line tax ---------------------------------------------------------
  let cgst = ZERO;
  let sgst = ZERO;
  let igst = ZERO;
  let taxTotal = ZERO;

  const items: CalculationItemResult[] = input.items.map((item, i) => {
    const lineSubtotal = lineSubtotals[i];
    const discountAmount = allocations[i];
    const taxable = lineSubtotal.minus(discountAmount);
    const rate = D(item.taxRate);

    let lineTax: Decimal;
    if (input.gstEnabled && !input.isInterState) {
      // Split first, then round each half, so CGST + SGST equals the booked tax.
      const half = round2(taxable.times(rate).div(100).div(2));
      cgst = cgst.plus(half);
      sgst = sgst.plus(half);
      lineTax = half.times(2);
    } else {
      lineTax = round2(taxable.times(rate).div(100));
      if (input.gstEnabled) igst = igst.plus(lineTax);
    }
    taxTotal = taxTotal.plus(lineTax);

    return {
      lineSubtotal: toMoney(lineSubtotal),
      discountAmount: toMoney(discountAmount),
      taxableAmount: toMoney(taxable),
      taxAmount: toMoney(lineTax),
      lineTotal: toMoney(taxable.plus(lineTax)),
    };
  });

  const taxableAmount = subtotal.minus(discountTotal);
  const total = taxableAmount.plus(taxTotal);
  const totalInr = round2(total.times(D(input.exchangeRate)));

  return {
    items,
    subtotal: toMoney(subtotal),
    discountAmount: toMoney(discountTotal),
    taxableAmount: toMoney(taxableAmount),
    cgstAmount: toMoney(cgst),
    sgstAmount: toMoney(sgst),
    igstAmount: toMoney(igst),
    taxAmount: toMoney(taxTotal),
    total: toMoney(total),
    totalInr: toMoney(totalInr),
  };
}

/** Balance due after payments, never below zero. */
export function calculateBalance(total: DecimalInput, amountPaid: DecimalInput): string {
  const balance = D(total).minus(D(amountPaid));
  return toMoney(balance.lessThan(0) ? ZERO : balance);
}
