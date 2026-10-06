import Decimal from "decimal.js";

/**
 * Money arithmetic.
 *
 * All financial maths in this project goes through decimal.js. Never use `+`,
 * `-`, `*`, `/` on monetary values. Amounts travel through the app as strings
 * (PostgreSQL `numeric` comes back as a string from Drizzle) and are converted
 * with `D()` at the point of calculation.
 */

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type DecimalInput = Decimal.Value;

/** Shorthand constructor that tolerates blank input (treated as zero). */
export function D(value: DecimalInput | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") return new Decimal(0);
  return new Decimal(value);
}

/** Round to 2 decimal places, half-up, and return as a fixed string ("12.50"). */
export function toMoney(value: DecimalInput): string {
  return D(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/** Exchange rates keep 8 decimal places. */
export function toRate(value: DecimalInput): string {
  return D(value).toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toFixed(8);
}

/** Quantities keep 3 decimal places. */
export function toQuantity(value: DecimalInput): string {
  return D(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toFixed(3);
}

export function sum(values: DecimalInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(D(v)), new Decimal(0));
}

export function isZero(value: DecimalInput): boolean {
  return D(value).isZero();
}

export function isPositive(value: DecimalInput): boolean {
  return D(value).greaterThan(0);
}

export function compare(a: DecimalInput, b: DecimalInput): -1 | 0 | 1 {
  return D(a).comparedTo(D(b)) as -1 | 0 | 1;
}

/** Converts an amount in a foreign currency to INR using a stored rate (INR per unit). */
export function toInr(amount: DecimalInput, rateToInr: DecimalInput): string {
  return toMoney(D(amount).times(D(rateToInr)));
}

export { Decimal };
