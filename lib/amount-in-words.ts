import { getCurrency } from "@/lib/currency";
import { D, Decimal } from "@/lib/money";

/**
 * Spells a monetary amount out in English, as printed under invoice totals:
 *
 *   amountInWords("123456.78", "INR")
 *   -> "Rupees One Lakh Twenty-Three Thousand Four Hundred Fifty-Six and Paise Seventy-Eight Only"
 *
 *   amountInWords("1250.05", "USD")
 *   -> "US Dollars One Thousand Two Hundred Fifty and Cents Five Only"
 *
 * INR uses the Indian lakh/crore grouping; every other currency uses the
 * international thousand/million/billion grouping. Pure and dependency-free so
 * it can run in the PDF renderer, Server Components and the browser alike.
 */

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

/** 0-999 in words. */
function belowThousand(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest < 20) {
    if (rest) parts.push(ONES[rest]);
  } else {
    const unit = rest % 10;
    parts.push(unit ? `${TENS[Math.floor(rest / 10)]}-${ONES[unit]}` : TENS[Math.floor(rest / 10)]);
  }
  return parts.join(" ");
}

/** Indian system: crore (10^7), lakh (10^5), thousand, hundred. */
function indianWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  if (crore) parts.push(`${crore >= 100 ? indianWords(crore) : belowThousand(crore)} Crore`);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  const rest = n % 1000;
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
}

const SCALES = ["", "Thousand", "Million", "Billion", "Trillion", "Quadrillion"];

/** International system: thousand, million, billion, ... */
function internationalWords(n: number): string {
  if (n === 0) return "Zero";
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    if (!groups[i]) continue;
    parts.push(SCALES[i] ? `${belowThousand(groups[i])} ${SCALES[i]}` : belowThousand(groups[i]));
  }
  return parts.join(" ");
}

/**
 * Whole number in words. Money columns are numeric(14, 2), so the integer part
 * never exceeds 10^12 and stays exactly representable as a JS number.
 */
export function integerInWords(value: number, indianNumbering: boolean): string {
  const n = Math.floor(Math.abs(value));
  return indianNumbering ? indianWords(n) : internationalWords(n);
}

/** "Rupees Twelve Thousand and Paise Fifty Only" for an amount string like "12000.50". */
export function amountInWords(amount: Decimal.Value, currency: string): string {
  const def = getCurrency(currency);
  const value = D(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).abs();
  const whole = value.floor().toNumber();
  const minor = value.minus(value.floor()).times(100).toNumber();

  const parts = [`${def.unitWords} ${integerInWords(whole, def.indianNumbering)}`];
  if (minor) parts.push(`and ${def.subunitWords} ${belowThousand(minor)}`);
  return `${parts.join(" ")} Only`;
}
