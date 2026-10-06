import { and, desc, eq } from "drizzle-orm";

import { exchangeRates } from "@/db/schema";
import { BASE_CURRENCY, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { db } from "@/lib/db";
import { D, toRate } from "@/lib/money";

/**
 * Exchange rates to INR.
 *
 * Provider: open.er-api.com (free, keyless). It returns rates relative to a
 * base currency; we request INR as base and invert to get "INR per 1 unit".
 * Fetched rates are cached in `exchange_rates` for EXCHANGE_RATE_CACHE_HOURS.
 *
 * The invoice always stores the rate it used, so this cache only affects the
 * default suggested to the user; historical invoices never change.
 */

const PROVIDER_URL = `https://open.er-api.com/v6/latest/${BASE_CURRENCY}`;
const PROVIDER_NAME = "open.er-api.com";

export interface RateQuote {
  currency: string;
  /** INR per 1 unit of `currency`, 8 decimals. */
  rate: string;
  source: "api" | "base";
  fetchedAt: Date | null;
  /** True when the cache was stale and a refresh failed. */
  stale: boolean;
}

function cacheHours(): number {
  const h = Number(process.env.EXCHANGE_RATE_CACHE_HOURS ?? "12");
  return Number.isFinite(h) && h > 0 ? h : 12;
}

async function latestCached(currency: string) {
  const [row] = await db
    .select()
    .from(exchangeRates)
    .where(and(eq(exchangeRates.currency, currency)))
    .orderBy(desc(exchangeRates.fetchedAt))
    .limit(1);
  return row ?? null;
}

async function refreshAllRates(): Promise<Map<string, string>> {
  const res = await fetch(PROVIDER_URL, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Rate provider responded ${res.status}`);
  const json = (await res.json()) as { result?: string; rates?: Record<string, number> };
  if (json.result !== "success" || !json.rates) throw new Error("Rate provider returned an unexpected payload");

  const fetchedAt = new Date();
  const rows: { currency: string; rateToInr: string; source: string; fetchedAt: Date }[] = [];
  const out = new Map<string, string>();

  for (const def of SUPPORTED_CURRENCIES) {
    if (def.code === BASE_CURRENCY) continue;
    const perInr = json.rates[def.code];
    if (!perInr || perInr <= 0) continue;
    // provider gives units of X per 1 INR; invert for INR per 1 X.
    const rateToInr = toRate(D(1).div(D(perInr)));
    rows.push({ currency: def.code, rateToInr, source: PROVIDER_NAME, fetchedAt });
    out.set(def.code, rateToInr);
  }

  if (rows.length) await db.insert(exchangeRates).values(rows);
  return out;
}

export async function getRateToInr(currency: string): Promise<RateQuote> {
  if (currency === BASE_CURRENCY) {
    return { currency, rate: toRate(1), source: "base", fetchedAt: null, stale: false };
  }

  const cached = await latestCached(currency);
  const freshUntil = Date.now() - cacheHours() * 60 * 60 * 1000;
  if (cached && cached.fetchedAt.getTime() > freshUntil) {
    return { currency, rate: cached.rateToInr, source: "api", fetchedAt: cached.fetchedAt, stale: false };
  }

  try {
    const rates = await refreshAllRates();
    const rate = rates.get(currency);
    if (rate) return { currency, rate, source: "api", fetchedAt: new Date(), stale: false };
  } catch (error) {
    console.warn("[exchange-rates] refresh failed:", error instanceof Error ? error.message : error);
  }

  if (cached) {
    return { currency, rate: cached.rateToInr, source: "api", fetchedAt: cached.fetchedAt, stale: true };
  }
  throw new Error(`No exchange rate available for ${currency}. Enter the rate manually.`);
}
