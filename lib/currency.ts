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
  /** Plural unit name used when spelling an amount out, e.g. "Rupees". */
  unitWords: string;
  /** Plural minor-unit name used when spelling an amount out, e.g. "Paise". */
  subunitWords: string;
  /** Use the Indian lakh/crore grouping when spelling amounts out. */
  indianNumbering: boolean;
}

export const SUPPORTED_CURRENCIES: readonly CurrencyDefinition[] = [
  { code: "INR", name: "Indian Rupee", symbol: "₹", locale: "en-IN", unitWords: "Rupees", subunitWords: "Paise", indianNumbering: true },
  { code: "USD", name: "US Dollar", symbol: "$", locale: "en-US", unitWords: "US Dollars", subunitWords: "Cents", indianNumbering: false },
  { code: "EUR", name: "Euro", symbol: "€", locale: "de-DE", unitWords: "Euros", subunitWords: "Cents", indianNumbering: false },
  { code: "GBP", name: "British Pound", symbol: "£", locale: "en-GB", unitWords: "Pounds Sterling", subunitWords: "Pence", indianNumbering: false },
  { code: "AED", name: "UAE Dirham", symbol: "AED", locale: "en-AE", unitWords: "UAE Dirhams", subunitWords: "Fils", indianNumbering: false },
] as const;

export const CURRENCY_CODES = SUPPORTED_CURRENCIES.map((c) => c.code) as [string, ...string[]];

/** The currency all reports and dashboard totals are normalised to. */
export const BASE_CURRENCY = "INR";

export function getCurrency(code: string): CurrencyDefinition {
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code === code) ?? {
      code,
      name: code,
      symbol: code,
      locale: "en-US",
      unitWords: code,
      subunitWords: "Cents",
      indianNumbering: false,
    }
  );
}

export function isSupportedCurrency(code: string): boolean {
  return SUPPORTED_CURRENCIES.some((c) => c.code === code);
}
