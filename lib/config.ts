/**
 * Static application configuration.
 *
 * Values here are build-time constants that do not belong in the database.
 * Per-business settings (business name, GSTIN, address, GST enabled, ...) will
 * live in a `business_settings` table and must NOT be added here.
 */

export const appConfig = {
  /** Product name shown in the sidebar, header and page titles. */
  name: "Invoice Generator",
  /**
   * Reporting currency. Dashboard and report totals are normalised to this
   * currency using the exchange rate stored on each invoice.
   */
  reportingCurrency: "INR",
} as const;
