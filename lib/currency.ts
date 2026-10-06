/**
 * Currency definitions shared by client and server code.
 *
 * To add a currency: append it to SUPPORTED_CURRENCIES. The rate provider
 * (lib/data/exchange-rates.ts) fetches rates for every entry here.
 */

export interface CurrencyDefinition {
  code: string;
  name: string;
  symbol: string;
  /** Locale used for number formatting of this currency. */
  locale: string;
}

export const SUPPORTED_CURRENCIES: readonly CurrencyDefinition[] = [
  { code: "INR", name: "Indian Rupee", symbol: "₹", locale: "en-IN" },
  { code: "USD", name: "US Dollar", symbol: "$", locale: "en-US" },
  { code: "EUR", name: "Euro", symbol: "€", locale: "de-DE" },
  { code: "GBP", name: "British Pound", symbol: "£", locale: "en-GB" },
  { code: "AED", name: "UAE Dirham", symbol: "AED", locale: "en-AE" },
] as const;

export const CURRENCY_CODES = SUPPORTED_CURRENCIES.map((c) => c.code) as [string, ...string[]];

/** The currency all reports and dashboard totals are normalised to. */
export const BASE_CURRENCY = "INR";

export function getCurrency(code: string): CurrencyDefinition {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code) ?? { code, name: code, symbol: code, locale: "en-US" };
}

export function isSupportedCurrency(code: string): boolean {
  return SUPPORTED_CURRENCIES.some((c) => c.code === code);
}
