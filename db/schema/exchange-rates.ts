import { char, index, numeric, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Cache of fetched exchange rates (units of INR per 1 unit of `currency`).
 * Shared across businesses; rates are public data. Invoices copy the rate they
 * used into their own row, so rows here can be pruned freely.
 */
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: uuid().primaryKey().defaultRandom(),
    currency: char({ length: 3 }).notNull(),
    rateToInr: numeric({ precision: 18, scale: 8 }).notNull(),
    source: varchar({ length: 60 }).notNull(),
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("exchange_rates_currency_fetched_idx").on(t.currency, t.fetchedAt)],
);

export type ExchangeRate = typeof exchangeRates.$inferSelect;
